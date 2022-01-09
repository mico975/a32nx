// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { ProcedureTransition } from 'msfs-navdata';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { FlightPlan } from '../plans/FlightPlan';

export class ArrivalEnrouteTransitionSegment extends FlightPlanSegment {
    class = SegmentClass.Arrival

    allLegs: FlightPlanElement[] = []

    private arrivalEnrouteTransition: ProcedureTransition | undefined = undefined

    get arrivalEnrouteTransitionProcedure() {
        return this.arrivalEnrouteTransition;
    }

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    setArrivalEnrouteTransition(transitionIdent: string | undefined) {
        if (transitionIdent === undefined) {
            this.arrivalEnrouteTransition = undefined;
            this.allLegs.length = 0;
            return;
        }

        const { destinationAirport, destinationRunway, arrival } = this.flightPlan;

        if (!destinationAirport || !destinationRunway || !arrival) {
            throw new Error('[FMS/FPM] Cannot set arrival enroute transition without destination airport, runway and STAR');
        }

        const arrivalEnrouteTransitions = arrival.enrouteTransitions;

        const matchingArrivalEnrouteTransition = arrivalEnrouteTransitions.find((transition) => transition.ident === transitionIdent);

        if (!matchingArrivalEnrouteTransition) {
            throw new Error(`[FMS/FPM] Can't find arrival enroute transition '${transitionIdent}' for ${destinationAirport.ident} ${arrival.ident}`);
        }

        this.arrivalEnrouteTransition = matchingArrivalEnrouteTransition;
        this.allLegs.length = 0;

        const mappedArrivalEnrouteTransitionLegs = matchingArrivalEnrouteTransition.legs.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingArrivalEnrouteTransition.ident));
        this.allLegs.push(...mappedArrivalEnrouteTransitionLegs);
        this.strung = false;

        this.flightPlan.stringSegmentsForwards(this.flightPlan.previousSegment(this), this);
        this.flightPlan.stringSegmentsForwards(this, this.flightPlan.nextSegment(this));
        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): ArrivalEnrouteTransitionSegment {
        const newSegment = new ArrivalEnrouteTransitionSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.arrivalEnrouteTransition = this.arrivalEnrouteTransition;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
