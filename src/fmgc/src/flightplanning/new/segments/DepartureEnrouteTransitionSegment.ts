// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { ProcedureTransition } from 'msfs-navdata';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement, FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { FlightPlan } from '@fmgc/flightplanning/new/plans/FlightPlan';

export class DepartureEnrouteTransitionSegment extends FlightPlanSegment {
    class = SegmentClass.Departure

    allLegs: FlightPlanElement[] = []

    private departureEnrouteTransition: ProcedureTransition | undefined = undefined

    get departureEnrouteTransitionProcedure() {
        return this.departureEnrouteTransition;
    }

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    setDepartureEnrouteTransition(transitionIdent: string | undefined) {
        if (transitionIdent === undefined) {
            this.departureEnrouteTransition = undefined;
            this.allLegs.length = 0;
            return;
        }

        const { originAirport, originRunway, originDeparture } = this.flightPlan;

        if (!originAirport || !originRunway || !originDeparture) {
            throw new Error('[FMS/FPM] Cannot set origin enroute transition without destination airport, runway and SID');
        }

        const originEnrouteTransitions = originDeparture.enrouteTransitions;

        const matchingOriginEnrouteTransition = originEnrouteTransitions.find((transition) => transition.ident === transitionIdent);

        if (!matchingOriginEnrouteTransition) {
            throw new Error(`[FMS/FPM] Can't find origin enroute transition '${transitionIdent}' for ${originAirport.ident} ${originDeparture.ident}`);
        }

        this.departureEnrouteTransition = matchingOriginEnrouteTransition;
        this.allLegs.length = 0;

        const mappedOriginEnrouteTransitionLegs = matchingOriginEnrouteTransition.legs.map((leg) => FlightPlanLeg.fromProcedureLeg(this, leg, matchingOriginEnrouteTransition.ident));
        this.allLegs.push(...mappedOriginEnrouteTransitionLegs);
        this.strung = false;

        this.flightPlan.stringSegmentsForwards(this.flightPlan.previousSegment(this), this);
        this.flightPlan.stringSegmentsForwards(this, this.flightPlan.nextSegment(this));
        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): DepartureEnrouteTransitionSegment {
        const newSegment = new DepartureEnrouteTransitionSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.departureEnrouteTransition = this.departureEnrouteTransition;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
