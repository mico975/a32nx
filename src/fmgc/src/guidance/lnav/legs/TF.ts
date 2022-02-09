// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { GuidanceParameters } from '@fmgc/guidance/ControlLaws';
import { MathUtils } from '@shared/MathUtils';
import { AltitudeConstraint, SpeedConstraint } from '@fmgc/guidance/lnav/legs';
import { SegmentType } from '@fmgc/wtsdk';
import { WaypointConstraintType } from '@fmgc/flightplanning/FlightPlanManager';
import { Coordinates } from '@fmgc/flightplanning/data/geo';
import { Guidable } from '@fmgc/guidance/Guidable';
import { XFLeg } from '@fmgc/guidance/lnav/legs/XF';
import { courseToFixDistanceToGo, fixToFixGuidance, getIntermediatePoint } from '@fmgc/guidance/lnav/CommonGeometry';
import { LnavConfig } from '@fmgc/guidance/LnavConfig';
import { Waypoint } from 'msfs-navdata';
import { fixCoordinates } from '@fmgc/flightplanning/new/utils';
import { bearingTo } from 'msfs-geo';
import { LegMetadata } from '@fmgc/guidance/lnav/legs/index';
import { PathVector, PathVectorType } from '../PathVector';

export class TFLeg extends XFLeg {
    constraintType: WaypointConstraintType;

    private readonly course: Degrees;

    private computedPath: PathVector[] = [];

    altitudeConstraint: AltitudeConstraint | undefined

    speedConstraint: SpeedConstraint | undefined

    constructor(
        public from: Waypoint,
        public to: Waypoint,
        public readonly metadata: Readonly<LegMetadata>,
        segment: SegmentType,
    ) {
        super(to);

        this.from = from;
        this.to = to;
        this.segment = segment;
        this.constraintType = WaypointConstraintType.CLB;
        this.course = bearingTo(
            fixCoordinates(this.from.location),
            fixCoordinates(this.to.location),
        );
    }

    get inboundCourse(): DegreesTrue {
        return bearingTo(fixCoordinates(this.from.location), fixCoordinates(this.to.location));
    }

    get outboundCourse(): DegreesTrue {
        return bearingTo(fixCoordinates(this.from.location), fixCoordinates(this.to.location));
    }

    get predictedPath(): PathVector[] {
        return this.computedPath;
    }

    getPathStartPoint(): Coordinates | undefined {
        return this.inboundGuidable?.isComputed ? this.inboundGuidable.getPathEndPoint() : fixCoordinates(this.from.location);
    }

    recomputeWithParameters(_isActive: boolean, _tas: Knots, _gs: Knots, _ppos: Coordinates, _trueTrack: DegreesTrue, previousGuidable: Guidable, nextGuidable: Guidable) {
        this.inboundGuidable = previousGuidable;
        this.outboundGuidable = nextGuidable;

        const startPoint = this.getPathStartPoint();
        const endPoint = this.getPathEndPoint();

        this.computedPath.length = 0;

        if (this.overshot) {
            this.computedPath.push({
                type: PathVectorType.Line,
                startPoint: endPoint,
                endPoint,
            });
        } else {
            this.computedPath.push({
                type: PathVectorType.Line,
                startPoint,
                endPoint,
            });
        }

        if (LnavConfig.DEBUG_PREDICTED_PATH) {
            this.computedPath.push({
                type: PathVectorType.DebugPoint,
                startPoint: endPoint,
                annotation: 'TF END',
            });
        }

        this.isComputed = true;
    }

    getPseudoWaypointLocation(distanceBeforeTerminator: NauticalMiles): Coordinates | undefined {
        return getIntermediatePoint(
            this.getPathStartPoint(),
            this.getPathEndPoint(),
            (this.distance - distanceBeforeTerminator) / this.distance,
        );
    }

    getGuidanceParameters(ppos: Coordinates, trueTrack: Degrees): GuidanceParameters | null {
        return fixToFixGuidance(ppos, trueTrack, fixCoordinates(this.from.location), fixCoordinates(this.to.location));
    }

    getNominalRollAngle(_gs: Knots): Degrees {
        return 0;
    }

    /**
     * Calculates the angle between the leg and the aircraft PPOS.
     *
     * This effectively returns the angle ABC in the figure shown below:
     *
     * ```
     * * A
     * |
     * * B (TO)
     * |\
     * | \
     * |  \
     * |   \
     * |    \
     * |     \
     * |      \
     * * FROM  * C (PPOS)
     * ```
     *
     * @param ppos {LatLong} the current position of the aircraft
     */
    getAircraftToLegBearing(ppos: LatLongData): number {
        const aircraftToTerminationBearing = Avionics.Utils.computeGreatCircleHeading(ppos, fixCoordinates(this.to.location));
        const aircraftLegBearing = MathUtils.smallCrossingAngle(this.outboundCourse, aircraftToTerminationBearing);

        return aircraftLegBearing;
    }

    getDistanceToGo(ppos: LatLongData): NauticalMiles {
        return courseToFixDistanceToGo(ppos, this.course, this.getPathEndPoint());
    }

    isAbeam(ppos: LatLongAlt): boolean {
        const bearingAC = Avionics.Utils.computeGreatCircleHeading(fixCoordinates(this.from.location), ppos);
        const headingAC = Math.abs(MathUtils.diffAngle(this.inboundCourse, bearingAC));
        if (headingAC > 90) {
            // if we're even not abeam of the starting point
            return false;
        }
        const distanceAC = Avionics.Utils.computeDistance(fixCoordinates(this.from.location), ppos);
        const distanceAX = Math.cos(headingAC * Avionics.Utils.DEG2RAD) * distanceAC;
        // if we're too far away from the starting point to be still abeam of the ending point
        return distanceAX <= this.distance;
    }

    get repr(): string {
        return `TF FROM ${this.from.ident} TO ${this.to.ident}`;
    }
}
