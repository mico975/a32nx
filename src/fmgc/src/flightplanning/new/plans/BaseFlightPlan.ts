// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Approach, Arrival, Departure, ProcedureTransition, Runway } from 'msfs-navdata';
import { OriginSegment } from '@fmgc/flightplanning/new/segments/OriginSegment';
import { FlightPlanElement } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { DepartureSegment } from '@fmgc/flightplanning/new/segments/DepartureSegment';
import { ArrivalSegment } from '@fmgc/flightplanning/new/segments/ArrivalSegment';
import { ApproachSegment } from '@fmgc/flightplanning/new/segments/ApproachSegment';
import { DestinationSegment } from '@fmgc/flightplanning/new/segments/DestinationSegment';
import { DepartureEnrouteTransitionSegment } from '@fmgc/flightplanning/new/segments/DepartureEnrouteTransitionSegment';
import { DepartureRunwayTransitionSegment } from '@fmgc/flightplanning/new/segments/DepartureRunwayTransitionSegment';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { EnrouteSegment } from '@fmgc/flightplanning/new/segments/EnrouteSegment';
import { ArrivalEnrouteTransitionSegment } from '@fmgc/flightplanning/new/segments/ArrivalEnrouteTransitionSegment';
import { MissedApproachSegment } from '@fmgc/flightplanning/new/segments/MissedApproachSegment';
import { ArrivalRunwayTransitionSegment } from '@fmgc/flightplanning/new/segments/ArrivalRunwayTransitionSegment';
import { ApproachViaSegment } from '@fmgc/flightplanning/new/segments/ApproachViaSegment';
import { SegmentClass } from '@fmgc/flightplanning/new/segments/SegmentClass';
import { WaypointStats } from '@fmgc/flightplanning/data/flightplan';

export abstract class BaseFlightPlan {
    get legCount() {
        return this.allLegs.length;
    }

    get firstMissedApproachLeg() {
        return this.allLegs.length - this.missedApproachSegment.allLegs.length;
    }

    activeLegIndex = 1;

    sequence() {
        this.activeLegIndex++;
    }

    version = 0;

    incrementVersion() {
        this.version++;
    }

    originSegment = new OriginSegment(this);

    departureRunwayTransitionSegment = new DepartureRunwayTransitionSegment(this);

    departureSegment = new DepartureSegment(this);

    departureEnrouteTransitionSegment = new DepartureEnrouteTransitionSegment(this)

    enrouteSegment = new EnrouteSegment(this);

    arrivalEnrouteTransitionSegment = new ArrivalEnrouteTransitionSegment(this);

    arrivalSegment = new ArrivalSegment(this);

    arrivalRunwayTransitionSegment = new ArrivalRunwayTransitionSegment(this);

    approachViaSegment = new ApproachViaSegment(this);

    approachSegment = new ApproachSegment(this);

    destinationSegment = new DestinationSegment(this);

    missedApproachSegment = new MissedApproachSegment(this);

    availableOriginRunways: Runway[] = [];

    availableDepartures: Departure[] = [];

    availableDestinationRunways: Runway[] = [];

    availableArrivals: Arrival[] = [];

    availableApproaches: Approach[] = [];

    availableApproachVias: ProcedureTransition[] = [];

    get originLeg() {
        return this.originSegment.allLegs[0];
    }

    get destinationLeg() {
        const index = this.destinationLegIndex;

        return this.allLegs[index];
    }

    get destinationLegIndex() {
        let accumulator = 0;
        for (const segment of this.orderedSegments) {
            accumulator += segment.allLegs.length;

            if (segment === this.destinationSegment) {
                break;
            }
        }

        return accumulator - 1;
    }

    elementAt(index: number): FlightPlanElement {
        const legs = this.allLegs;

        if (index < 0 || index > legs.length) {
            throw new Error('[FMS/FPM] leg index out of bounds');
        }

        return legs[index];
    }

    private lastAllLegsVersion = -1;

    private cachedAllLegs = [];

    get allLegs(): FlightPlanElement[] {
        if (this.lastAllLegsVersion !== this.version) {
            this.lastAllLegsVersion = this.version;

            this.cachedAllLegs = [
                ...this.originSegment.allLegs,
                ...this.departureRunwayTransitionSegment.allLegs,
                ...this.departureSegment.allLegs,
                ...this.departureEnrouteTransitionSegment.allLegs,
                ...this.enrouteSegment.allLegs,
                ...this.arrivalEnrouteTransitionSegment.allLegs,
                ...this.arrivalSegment.allLegs,
                ...this.arrivalRunwayTransitionSegment.allLegs,
                ...this.approachViaSegment.allLegs,
                ...this.approachSegment.allLegs,
                ...this.destinationSegment.allLegs,
                ...this.missedApproachSegment.allLegs,
            ];
        }

        return this.cachedAllLegs;
    }

    public computeWaypointStatistics(): Map<number, WaypointStats> {
        const stats = new Map<number, WaypointStats>();

        for (const element of this.allLegs) {
            if (element.isDiscontinuity === true) {
                continue;
            }

            const index = this.allLegs.findIndex((it) => it.isDiscontinuity === false && it.ident === element.ident);

            const data = {
                ident: element.ident,
                bearingInFp: 0,
                distanceInFP: 0,
                distanceFromPpos: 0,
                timeFromPpos: 0,
                etaFromPpos: 0,
                magneticVariation: 0,
            };

            stats.set(index, data);
        }

        return stats;
    }

    protected get orderedSegments() {
        return [
            this.originSegment,
            this.departureRunwayTransitionSegment,
            this.departureSegment,
            this.departureEnrouteTransitionSegment,
            this.enrouteSegment,
            this.arrivalEnrouteTransitionSegment,
            this.arrivalSegment,
            this.arrivalRunwayTransitionSegment,
            this.approachViaSegment,
            this.approachSegment,
            this.destinationSegment,
            this.missedApproachSegment,
        ];
    }

    /**
     * Returns the last flight plan segment containing at least one leg
     *
     * @param before the segment
     */
    public previousSegment(before: FlightPlanSegment) {
        const segments = this.orderedSegments;
        const segmentIndex = segments.findIndex((s) => s === before);

        if (segmentIndex === -1) {
            throw new Error('[FMS/FPM] Invalid segment passed to prevSegment');
        }

        let prevSegmentIndex = segmentIndex - 1;
        let prevSegment = segments[prevSegmentIndex];
        while (prevSegment.allLegs.length === 0 && prevSegmentIndex > 0) {
            prevSegmentIndex--;
            prevSegment = segments[prevSegmentIndex];
        }

        if (prevSegment.allLegs.length > 0) {
            return prevSegment;
        }

        return undefined;
    }

    /**
     * Returns the next flight plan segment containing at least one leg
     *
     * @param after the segment
     */
    public nextSegment(after: FlightPlanSegment) {
        const segments = this.orderedSegments;
        const segmentIndex = segments.findIndex((s) => s === after);

        if (segmentIndex === -1) {
            throw new Error('[FMS/FPM] Invalid segment passed to nextSegment');
        }

        let nextSegmentIndex = segmentIndex + 1;
        let nextSegment = segments[nextSegmentIndex];
        while (nextSegment && nextSegment.allLegs.length === 0 && nextSegmentIndex < segments.length) {
            nextSegmentIndex++;
            nextSegment = segments[nextSegmentIndex];
        }

        if (nextSegment && nextSegment.allLegs.length > 0) {
            return nextSegment;
        }

        return undefined;
    }

    get originAirport(): Airport {
        return this.originSegment.originAirport;
    }

    async setOriginAirport(icao: string) {
        await this.originSegment.setOriginIcao(icao);
        await this.departureSegment.setDepartureProcedure(undefined);
        this.enrouteSegment.allLegs.length = 0;
        await this.arrivalSegment.setArrivalProcedure(undefined);
        await this.approachSegment.setApproachProcedure(undefined);

        this.incrementVersion();
    }

    get originRunway(): Runway {
        return this.originSegment.originRunway;
    }

    setOriginRunway(runwayIdent: string) {
        return this.originSegment.setOriginRunway(runwayIdent).then(() => this.incrementVersion());
    }

    get departureRunwayTransition(): ProcedureTransition {
        return this.departureRunwayTransitionSegment.departureRunwayTransitionProcedure;
    }

    get originDeparture(): Departure {
        return this.departureSegment.originDeparture;
    }

    setDeparture(procedureIdent: string | undefined) {
        return this.departureSegment.setDepartureProcedure(procedureIdent).then(() => this.incrementVersion());
    }

    get departureEnrouteTransition(): ProcedureTransition {
        return this.departureEnrouteTransitionSegment.departureEnrouteTransitionProcedure;
    }

    /**
     * Sets the departure enroute transition
     *
     * @param transitionIdent the transition ident or `undefined` for NONE
     */
    async setDepartureEnrouteTransition(transitionIdent: string | undefined) {
        this.departureEnrouteTransitionSegment.setDepartureEnrouteTransition(transitionIdent);

        this.incrementVersion();
    }

    get arrivalEnrouteTransition(): ProcedureTransition {
        return this.arrivalEnrouteTransitionSegment.arrivalEnrouteTransitionProcedure;
    }

    /**
     * Sets the arrival enroute transition
     *
     * @param transitionIdent the transition ident or `undefined` for NONE
     */
    setArrivalEnrouteTransition(transitionIdent: string | undefined) {
        this.arrivalEnrouteTransitionSegment.setArrivalEnrouteTransition(transitionIdent);

        this.incrementVersion();
    }

    get arrival() {
        return this.arrivalSegment.arrivalProcedure;
    }

    setArrival(procedureIdent: string | undefined) {
        return this.arrivalSegment.setArrivalProcedure(procedureIdent).then(() => this.incrementVersion());
    }

    get arrivalRunwayTransition() {
        return this.arrivalRunwayTransitionSegment.arrivalRunwayTransitionProcedure;
    }

    get approachVia() {
        return this.approachViaSegment.approachViaProcedure;
    }

    /**
     * Sets the approach via
     *
     * @param transitionIdent the transition ident or `undefined` for NONE
     */
    setApproachVia(transitionIdent: string | undefined) {
        this.approachViaSegment.setApproachVia(transitionIdent);

        this.incrementVersion();
    }

    get approach() {
        return this.approachSegment.approachProcedure;
    }

    async setApproach(procedureIdent: string | undefined) {
        return this.approachSegment.setApproachProcedure(procedureIdent).then(() => this.incrementVersion());
    }

    get destinationAirport(): Airport {
        return this.destinationSegment.destinationAirport;
    }

    setDestinationAirport(icao: string) {
        return this.destinationSegment.setDestinationIcao(icao).then(() => this.incrementVersion());
    }

    get destinationRunway(): Runway {
        return this.destinationSegment.destinationRunway;
    }

    setDestinationRunway(runwayIdent: string) {
        return this.destinationSegment.setDestinationRunway(runwayIdent).then(() => this.incrementVersion());
    }

    removeElementAt(index: number): boolean {
        const [segment, indexInSegment] = this.segmentPositionForIndex(index);

        segment.allLegs.splice(indexInSegment, 1);

        this.redistributeLegsAt(index + 1);

        this.incrementVersion();

        return true;
    }

    /**
     * Finds the segment and index in segment of a given flight plan index
     *
     * @param index the given index
     *
     * @private
     */
    private segmentPositionForIndex(index: number): [segment: FlightPlanSegment, indexInSegment: number] {
        if (index < 0) {
            throw new Error('[FMS/FPM] Tried to get segment for out-of-bounds index');
        }

        let accumulator = 0;
        for (const segment of this.orderedSegments) {
            accumulator += segment.allLegs.length;

            if (accumulator > index) {
                return [segment, index - (accumulator - segment.allLegs.length)];
            }
        }

        throw new Error('[FMS/FPM] Tried to get segment for out-of-bounds index');
    }

    /**
     * Redistributes flight plan elements at a point, either moving previous or next non-enroute legs into the enroute, depending on the index
     *
     * @param index point at which to redistribute
     */
    redistributeLegsAt(index: number) {
        const [segment, indexInSegment] = this.segmentPositionForIndex(index);

        if (segment.class === SegmentClass.Departure) {
            const toInsertInEnroute: FlightPlanElement[] = [];

            let emptyAllNext = false;

            if (segment === this.departureRunwayTransitionSegment) {
                emptyAllNext = true;

                toInsertInEnroute.push(...this.departureRunwayTransitionSegment.truncate(indexInSegment));
            }

            if (segment === this.departureSegment) {
                emptyAllNext = true;

                toInsertInEnroute.push(...this.departureSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.departureSegment.allLegs.slice();
                this.departureSegment.allLegs.length = 0;

                toInsertInEnroute.push(...removed);
            }

            if (segment === this.departureEnrouteTransitionSegment) {
                toInsertInEnroute.push(...this.departureEnrouteTransitionSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.departureEnrouteTransitionSegment.allLegs.slice();
                this.departureEnrouteTransitionSegment.allLegs.length = 0;

                toInsertInEnroute.push(...removed);
            }

            for (const element of toInsertInEnroute) {
                if (element.isDiscontinuity === false) {
                    element.annotation = 'TRUNC D';
                }
            }

            this.enrouteSegment.allLegs.unshift(...toInsertInEnroute);
        } else if (segment.class === SegmentClass.Arrival) {
            const toInsertInEnroute: FlightPlanElement[] = [];

            let emptyAllNext = false;

            if (segment === this.approachSegment) {
                emptyAllNext = true;

                toInsertInEnroute.unshift(...this.approachSegment.truncate(indexInSegment));
            }

            if (segment === this.approachViaSegment) {
                emptyAllNext = true;

                toInsertInEnroute.unshift(...this.approachViaSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.approachViaSegment.allLegs.slice();
                this.approachViaSegment.allLegs.length = 0;

                toInsertInEnroute.unshift(...removed);
            }

            if (segment === this.arrivalRunwayTransitionSegment) {
                emptyAllNext = true;

                toInsertInEnroute.unshift(...this.arrivalRunwayTransitionSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.arrivalRunwayTransitionSegment.allLegs.slice();
                this.arrivalRunwayTransitionSegment.allLegs.length = 0;

                toInsertInEnroute.unshift(...removed);
            }

            if (segment === this.arrivalSegment) {
                emptyAllNext = true;

                toInsertInEnroute.unshift(...this.arrivalSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.arrivalSegment.allLegs.slice();
                this.arrivalSegment.allLegs.length = 0;

                toInsertInEnroute.unshift(...removed);
            }

            if (segment === this.arrivalEnrouteTransitionSegment) {
                toInsertInEnroute.unshift(...this.arrivalEnrouteTransitionSegment.truncate(indexInSegment));
            } else if (emptyAllNext) {
                const removed = this.arrivalEnrouteTransitionSegment.allLegs.slice();
                this.arrivalEnrouteTransitionSegment.allLegs.length = 0;

                toInsertInEnroute.unshift(...removed);
            }

            for (const element of toInsertInEnroute) {
                if (element.isDiscontinuity === false) {
                    element.annotation = 'TRUNC A';
                }
            }

            this.enrouteSegment.allLegs.push(...toInsertInEnroute);
        } else {
            // Do nothing
        }
    }

    stringSegmentsForwards(first: FlightPlanSegment, second: FlightPlanSegment) {
        if (first.strung || first.allLegs.length === 0 || second.allLegs.length === 0) {
            return;
        }

        const lastElementInFirst = first.allLegs[first.allLegs.length - 1];
        let lastLegInFirst = lastElementInFirst;

        if (lastLegInFirst?.isDiscontinuity === true) {
            lastLegInFirst = first.allLegs[first.allLegs.length - 2];

            if (!lastLegInFirst || lastLegInFirst?.isDiscontinuity === true) {
                throw new Error('[FMS/FPM] Segment legs only contained a discontinuity');
            }
        }

        let cutBefore = -1;
        for (let i = 0; i < second.allLegs.length; i++) {
            const element = second.allLegs[i];

            if (element.isDiscontinuity === true) {
                continue;
            }

            if (lastLegInFirst.isXf() && element.isXf()) {
                if (element.terminatesWithWaypoint(lastLegInFirst.terminationWaypoint())) {
                    cutBefore = i;
                    break;
                }
            }
        }

        // If not matching leg is found, insert a discontinuity (if there isn't one already) at the end of the first segment
        if (cutBefore === -1) {
            if (lastElementInFirst.isDiscontinuity === false) {
                first.allLegs.push({ isDiscontinuity: true });
            }

            this.incrementVersion();
            first.strung = false;

            return;
        }

        // Otherwise, clear a possible discontinuity and remove all elements before the matching leg and the last leg of the first segment
        if (lastElementInFirst.isDiscontinuity === true) {
            first.allLegs.pop();
        }
        first.allLegs.pop();

        for (let i = 0; i < cutBefore; i++) {
            second.allLegs.shift();
        }

        this.incrementVersion();
        first.strung = true;
    }
}
