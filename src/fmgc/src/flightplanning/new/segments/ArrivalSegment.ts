// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Arrival, Database, ExternalBackend } from 'msfs-navdata';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { FlightPlan } from '../plans/FlightPlan';

export class ArrivalSegment extends FlightPlanSegment {
    class = SegmentClass.Arrival

    allLegs: FlightPlanElement[] = []

    private arrival: Arrival | undefined

    get arrivalProcedure() {
        return this.arrival;
    }

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    async setArrivalProcedure(procedureIdent: string | undefined) {
        if (procedureIdent === undefined) {
            this.arrival = undefined;
            this.allLegs.length = 0;
            this.flightPlan.arrivalEnrouteTransitionSegment.setArrivalEnrouteTransition(undefined);
            return;
        }

        const db = new Database(new ExternalBackend('http://localhost:5000'));

        const { destinationAirport, destinationRunway } = this.flightPlan.destinationSegment;

        if (!destinationAirport || !destinationRunway) {
            throw new Error('[FMS/FPM] Cannot set approach without destination airport and runway');
        }

        const arrivals = await db.getArrivals(destinationAirport.ident);

        const matchingArrival = arrivals.find((arrival) => arrival.ident === procedureIdent);

        if (!matchingArrival) {
            throw new Error(`[FMS/FPM] Can't find arrival procedure '${procedureIdent}' for ${destinationAirport.ident}`);
        }

        const legs = [...matchingArrival.commonLegs];

        this.arrival = matchingArrival;
        this.allLegs.length = 0;

        const mappedArrivalLegs = legs.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingArrival.ident));
        this.allLegs.push(...mappedArrivalLegs);

        const matchingRunwayTransition = matchingArrival.runwayTransitions.find((transition) => transition.ident === destinationRunway.ident);

        const mappedRunwayTransitionLegs = matchingRunwayTransition?.legs?.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingArrival.ident)) ?? [];
        this.flightPlan.arrivalRunwayTransitionSegment.setArrivalRunwayTransition(matchingRunwayTransition, mappedRunwayTransitionLegs);

        this.flightPlan.stringSegmentsForwards(this.flightPlan.previousSegment(this), this);
        this.flightPlan.stringSegmentsForwards(this, this.flightPlan.nextSegment(this));
        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): ArrivalSegment {
        const newSegment = new ArrivalSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.arrival = this.arrival;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
