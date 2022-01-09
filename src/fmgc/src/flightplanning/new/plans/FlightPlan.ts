// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Waypoint } from 'msfs-navdata';
import { FlightPlanDefinition } from '@fmgc/flightplanning/new/FlightPlanDefinition';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';
import { AlternateFlightPlan } from '@fmgc/flightplanning/new/plans/AlternateFlightPlan';
import { BaseFlightPlan } from '@fmgc/flightplanning/new/plans/BaseFlightPlan';

export class FlightPlan extends BaseFlightPlan {
    static empty(): FlightPlan {
        return new FlightPlan();
    }

    static fromDefinition(definition: FlightPlanDefinition): FlightPlan {
        return new FlightPlan();
    }

    /**
     * Alternate flight plan associated with this flight plan
     */
    alternateFlightPlan = new AlternateFlightPlan(this);

    clone(): FlightPlan {
        const newPlan = FlightPlan.empty();

        newPlan.originSegment = this.originSegment.clone(newPlan);
        newPlan.departureRunwayTransitionSegment = this.departureRunwayTransitionSegment.clone(newPlan);
        newPlan.departureSegment = this.departureSegment.clone(newPlan);
        newPlan.departureEnrouteTransitionSegment = this.departureEnrouteTransitionSegment.clone(newPlan);
        newPlan.enrouteSegment = this.enrouteSegment.clone(newPlan);
        newPlan.arrivalEnrouteTransitionSegment = this.arrivalEnrouteTransitionSegment.clone(newPlan);
        newPlan.arrivalSegment = this.arrivalSegment.clone(newPlan);
        newPlan.arrivalRunwayTransitionSegment = this.arrivalRunwayTransitionSegment.clone(newPlan);
        newPlan.approachViaSegment = this.approachViaSegment.clone(newPlan);
        newPlan.approachSegment = this.approachSegment.clone(newPlan);
        newPlan.destinationSegment = this.destinationSegment.clone(newPlan);
        newPlan.missedApproachSegment = this.missedApproachSegment.clone(newPlan);
        newPlan.alternateFlightPlan = this.alternateFlightPlan.clone(newPlan);

        newPlan.availableOriginRunways = [...this.availableOriginRunways];
        newPlan.availableDepartures = [...this.availableDepartures];
        newPlan.availableDestinationRunways = [...this.availableDestinationRunways];

        return newPlan;
    }

    get alternateDestinationAirport(): Airport {
        return this.alternateFlightPlan.destinationAirport;
    }

    async setAlternateDestinationAirport(icao: string) {
        return this.alternateFlightPlan.setDestinationAirport(icao);
    }

    insertWaypointAfter(index: number, waypoint: Waypoint) {
        if (index < 0 || index > this.allLegs.length) {
            throw new Error(`[FMS/FPM] Tried to insert waypoint out of bounds (index=${index})`);
        }

        const duplicate = this.findDuplicate(waypoint);

        if (duplicate) {
            const [startSegment, indexInStartSegment] = this.getIndexInSegment(index);
            const [endSegment, indexInEndSegment] = duplicate;

            if (startSegment === endSegment) {
                startSegment.removeRange(indexInStartSegment + 1, indexInEndSegment);
            } else {
                startSegment.removeAfter(indexInStartSegment + 1);
                endSegment.removeRange(0, indexInEndSegment);
            }
        }
    }

    private getIndexInSegment(index: number): [segment: FlightPlanSegment, index: number] {
        let maximum = this.departureSegment.allLegs.length;

        if (index < maximum) {
            return [this.departureSegment, index];
        }
        maximum += this.enrouteSegment.allLegs.length;

        if (index < maximum) {
            return [this.enrouteSegment, index - (maximum - this.enrouteSegment.allLegs.length)];
        }
        maximum += this.arrivalSegment.allLegs.length;

        if (index < maximum) {
            return [this.arrivalSegment, index - (maximum - this.arrivalSegment.allLegs.length)];
        }
        maximum += this.approachSegment.allLegs.length;

        if (index < maximum) {
            return [this.approachSegment, index - (maximum - this.approachSegment.allLegs.length)];
        }
        maximum += this.missedApproachSegment.allLegs.length;

        if (index < maximum) {
            return [this.missedApproachSegment, index - (maximum - this.missedApproachSegment.allLegs.length)];
        }

        throw new Error(`[FMS/FPM] Tried to find segment for an out of bounds index (index=${index})`);
    }

    findDuplicate(waypoint: Waypoint, afterIndex?: number): [FlightPlanSegment, number] | null {
        const departureDuplicate = this.departureSegment.findIndexOfWaypoint(waypoint, afterIndex);

        if (departureDuplicate !== -1) {
            return [this.departureSegment, departureDuplicate];
        }

        const enrouteDuplicate = this.enrouteSegment.findIndexOfWaypoint(waypoint, afterIndex - this.departureSegment.allLegs.length);

        if (enrouteDuplicate !== -1) {
            return [this.enrouteSegment, enrouteDuplicate];
        }

        const approachDuplicate = this.approachSegment.findIndexOfWaypoint(waypoint, afterIndex - this.enrouteSegment.allLegs.length - this.departureSegment.allLegs.length);

        if (approachDuplicate !== -1) {
            return [this.approachSegment, approachDuplicate];
        }

        // TODO missed approach ?

        return null;
    }
}
