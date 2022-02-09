// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Leg } from '@fmgc/guidance/lnav/legs/Leg';
import { FixedRadiusTransition } from '@fmgc/guidance/lnav/transitions/FixedRadiusTransition';
import { Coordinates } from '@fmgc/flightplanning/data/geo';
import { Guidable } from '@fmgc/guidance/Guidable';
import { Waypoint } from 'msfs-navdata';
import { DmeArcTransition } from '@fmgc/guidance/lnav/transitions/DmeArcTransition';
import { distanceTo } from 'msfs-geo';
import { sideOfPointOnCourseToFix } from '@fmgc/guidance/lnav/CommonGeometry';
import { fixCoordinates } from '@fmgc/flightplanning/new/utils';

export abstract class XFLeg extends Leg {
    protected constructor(
        public fix: Waypoint,
    ) {
        super();
    }

    protected inboundGuidable: Guidable | undefined;

    protected outboundGuidable: Guidable | undefined;

    getPathEndPoint(): Coordinates | undefined {
        if (this.outboundGuidable instanceof FixedRadiusTransition && this.outboundGuidable.isComputed) {
            return this.outboundGuidable.getPathStartPoint();
        }

        if (this.outboundGuidable instanceof DmeArcTransition && this.outboundGuidable.isComputed) {
            return this.outboundGuidable.getPathStartPoint();
        }

        return fixCoordinates(this.fix.location);
    }

    get terminationWaypoint(): Waypoint {
        return this.fix;
    }

    get ident(): string {
        return this.fix.ident;
    }

    get overflyTermFix(): boolean {
        return this.metadata.isOverfly;
    }

    /**
     * Returns `true` if the inbound transition has overshot the leg
     */
    get overshot(): boolean {
        const side = sideOfPointOnCourseToFix(fixCoordinates(this.fix.location), this.outboundCourse, this.getPathStartPoint());

        return side === 1;
    }

    get distanceToTermination(): NauticalMiles {
        const startPoint = this.getPathStartPoint();

        if (this.overshot) {
            return 0;
        }

        return distanceTo(startPoint, fixCoordinates(this.fix.location));
    }
}
