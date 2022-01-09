// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { LegType, Waypoint } from 'msfs-navdata';
import { FlightPlanElement } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';
import { FlightPlan } from '@fmgc/flightplanning/new/plans/FlightPlan';

export abstract class FlightPlanSegment {
    abstract class: SegmentClass

    /**
     * All the leg contained in this segment
     */
    abstract get allLegs(): FlightPlanElement[]

    /**
     * Whether the segment has already been strung
     */
    strung = false

    constructor(
        protected readonly flightPlan: BaseFlightPlan,
    ) {
    }

    /**
     * Creates an identical copy of this segment
     *
     * @param forPlan the (new) flight plan for which the segment is being cloned
     */
    abstract clone(forPlan: BaseFlightPlan): FlightPlanSegment

    /**
     * Removes all legs including and after `fromIndex` from the segment and merges them into the enroute segment
     *
     * @param atPoint
     */
    truncate(atPoint: number): FlightPlanElement[] {
        if (this.class === SegmentClass.Departure) {
            // Move legs after cut to enroute
            const removed = this.allLegs.splice(atPoint);

            return removed;
        }

        if (this.class === SegmentClass.Arrival) {
            // Move legs before cut to enroute
            const removed = [];
            for (let i = 0; i < atPoint; i++) {
                removed.push(this.allLegs.shift());
            }

            return removed;
        }

        throw new Error(`[FMS/FPM] Cannot truncate segment of class '${SegmentClass[this.class]}'`);
    }

    /**
     * Removes all legs between from (inclusive) and to (exclusive)
     *
     * @param from start of the range
     * @param to   end of the range
     */
    abstract removeRange(from: number, to: number): void

    /**
     * Removes all legs before to (exclusive)
     *
     * @param before end of the range
     */
    abstract removeBefore(before: number): void

    /**
     * Removes all legs after from (inclusive)
     *
     * @param from start of the range
     */
    abstract removeAfter(from: number): void

    insertNecessaryDiscontinuities() {
        for (let i = 0; i < this.allLegs.length; i++) {
            const element = this.allLegs[i];
            const nextElement = this.allLegs[i + 1];

            if (element.isDiscontinuity === true) {
                continue;
            }

            if ((nextElement?.isDiscontinuity ?? false) === false && (element.type === LegType.VM || element.type === LegType.FM)) {
                this.allLegs.splice(i + 1, 0, { isDiscontinuity: true });
                i++;
            }
        }
    }

    /**
     * Returns the index of a leg in the segment that terminates at the specified waypoint, or -1 if none is found
     *
     * @param waypoint the waypoint to look for
     */
    findIndexOfWaypoint(waypoint: Waypoint, afterIndex? :number): number {
        for (let i = 0; i < this.allLegs.length; i++) {
            if (i <= afterIndex) {
                continue;
            }

            const leg = this.allLegs[i];

            if (leg.isDiscontinuity === false && leg.terminatesWithWaypoint(waypoint)) {
                return i;
            }
        }

        return -1;
    }
}
