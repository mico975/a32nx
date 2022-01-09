// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { ProcedureTransition } from 'msfs-navdata';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { FlightPlan } from '../plans/FlightPlan';

export class DepartureRunwayTransitionSegment extends FlightPlanSegment {
    class = SegmentClass.Departure

    allLegs: FlightPlanElement[] = []

    private departureRunwayTransition: ProcedureTransition | undefined = undefined

    get departureRunwayTransitionProcedure() {
        return this.departureRunwayTransition;
    }

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    async setOriginRunwayTransitionSegment(transition: ProcedureTransition | undefined, legs: FlightPlanElement[]) {
        this.allLegs.length = 0;
        this.allLegs.push(...legs);
        this.strung = false;

        this.departureRunwayTransition = transition;

        await this.flightPlan.originSegment.refreshOriginLegs();
        const nextSegment = this.flightPlan.nextSegment(this);
        if (nextSegment) {
            this.flightPlan.stringSegmentsForwards(this, nextSegment);
        }
        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): DepartureRunwayTransitionSegment {
        const newSegment = new DepartureRunwayTransitionSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];
        newSegment.departureRunwayTransition = this.departureRunwayTransition;

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
