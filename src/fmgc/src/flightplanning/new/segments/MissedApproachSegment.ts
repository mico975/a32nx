// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { FlightPlanElement } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { FlightPlan } from '../plans/FlightPlan';

export class MissedApproachSegment extends FlightPlanSegment {
    class = SegmentClass.Arrival

    allLegs: FlightPlanElement[] = []

    constructor(
        flightPlan: BaseFlightPlan,
    ) {
        super(flightPlan);
    }

    setMissedApproachLegs(legs: FlightPlanElement[]) {
        this.allLegs.length = 0;
        this.allLegs.push(...legs);

        this.insertNecessaryDiscontinuities();
    }

    clone(forPlan: BaseFlightPlan): MissedApproachSegment {
        const newSegment = new MissedApproachSegment(forPlan);

        newSegment.allLegs = [...this.allLegs];

        return newSegment;
    }

    removeRange(_from: number, _to: number) {
    }

    removeAfter(_from: number) {
    }

    removeBefore(_before: number) {
    }
}
