// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Geometry } from '@fmgc/guidance/Geometry';
import { PseudoWaypoint } from '@fmgc/guidance/PsuedoWaypoint';
import { PseudoWaypoints } from '@fmgc/guidance/lnav/PseudoWaypoints';
import { EfisVectors } from '@fmgc/efis/EfisVectors';
import { Coordinates } from '@fmgc/flightplanning/data/geo';
import { EfisState } from '@fmgc/guidance/FmsState';
import { EfisSide, Mode, rangeSettings } from '@shared/NavigationDisplay';
import { TaskCategory, TaskQueue } from '@fmgc/guidance/TaskQueue';
import { FlightPlanService } from '@fmgc/flightplanning/new/FlightPlanService';
import { GeometryFactory } from '@fmgc/guidance/geometry/GeometryFactory';
import { FlightPlanIndex } from '@fmgc/flightplanning/new/FlightPlanManager';
import { HMLeg } from '@fmgc/guidance/lnav/legs/HX';
import { LnavDriver } from './lnav/LnavDriver';
import { FlightPlanManager } from '../flightplanning/FlightPlanManager';
import { GuidanceManager } from './GuidanceManager';
import { VnavDriver } from './vnav/VnavDriver';

// How often the (milliseconds)
const GEOMETRY_RECOMPUTATION_TIMER = 5_000;

export class GuidanceController {
    guidanceManager: GuidanceManager;

    lnavDriver: LnavDriver;

    vnavDriver: VnavDriver;

    pseudoWaypoints: PseudoWaypoints;

    efisVectors: EfisVectors;

    activeGeometry: Geometry | null;

    temporaryGeometry: Geometry | null;

    secondaryGeometry: Geometry | null;

    activeLegIndex: number;

    activeTransIndex: number;

    activeLegDtg: NauticalMiles;

    activeLegCompleteLegPathDtg: NauticalMiles;

    displayActiveLegCompleteLegPathDtg: NauticalMiles;

    focusedWaypointCoordinates: Coordinates = { lat: 0, long: 0 };

    currentPseudoWaypoints: PseudoWaypoint[] = [];

    automaticSequencing: boolean = true;

    leftEfisState: EfisState

    rightEfisState: EfisState

    efisStateForSide: { L: EfisState, R: EfisState }

    taskQueue = new TaskQueue();

    viewListener = RegisterViewListener('JS_LISTENER_SIMVARS', null, true);

    get hasTemporaryFlightPlan() {
        return FlightPlanService.hasTemporary;
    }

    private updateEfisState(side: EfisSide, state: EfisState): void {
        const ndMode = SimVar.GetSimVarValue(`L:A32NX_EFIS_${side}_ND_MODE`, 'Enum') as Mode;
        const ndRange = rangeSettings[SimVar.GetSimVarValue(`L:A32NX_EFIS_${side}_ND_RANGE`, 'Enum')];

        if (state?.mode !== ndMode || state?.range !== ndRange) {
            this.taskQueue.cancelAllInCategory(TaskCategory.EfisVectors);
            this.efisVectors.forceUpdate();
        }

        state.mode = ndMode;
        state.range = ndRange;
    }

    private lastFocusedWpIndex = -1;

    private updateMrpState() {
        // PLAN mode center

        // TODO port over
        // const focusedWpIndex = SimVar.GetSimVarValue('L:A32NX_SELECTED_WAYPOINT', 'number');
        // const focusedWp = this.flightPlanManager.getWaypoint(focusedWpIndex);
        //
        // if (this.lastFocusedWpIndex !== focusedWpIndex) {
        //     this.lastFocusedWpIndex = focusedWpIndex;
        //
        //     this.efisVectors.forceUpdate();
        // }
        //
        // if (focusedWp) {
        //     this.focusedWaypointCoordinates.lat = focusedWp.infos.coordinates.lat;
        //     this.focusedWaypointCoordinates.long = focusedWp.infos.coordinates.long;
        //
        //     SimVar.SetSimVarValue('L:A32NX_SELECTED_WAYPOINT_LAT', 'Degrees', this.focusedWaypointCoordinates.lat);
        //     SimVar.SetSimVarValue('L:A32NX_SELECTED_WAYPOINT_LONG', 'Degrees', this.focusedWaypointCoordinates.long);
        // }
    }

    private updateMapPartlyDisplayed() {
        if (this.efisStateForSide.L.dataLimitReached || this.efisStateForSide.L.legsCulled) {
            SimVar.SetSimVarValue('L:A32NX_EFIS_L_MAP_PARTLY_DISPLAYED', 'boolean', true);
        } else {
            SimVar.SetSimVarValue('L:A32NX_EFIS_L_MAP_PARTLY_DISPLAYED', 'boolean', false);
        }

        if (this.efisStateForSide.R.dataLimitReached || this.efisStateForSide.R.legsCulled) {
            SimVar.SetSimVarValue('L:A32NX_EFIS_R_MAP_PARTLY_DISPLAYED', 'boolean', true);
        } else {
            SimVar.SetSimVarValue('L:A32NX_EFIS_R_MAP_PARTLY_DISPLAYED', 'boolean', false);
        }
    }

    private updateEfisIdent() {
        // Update EFIS ident

        const efisIdent = this.activeGeometry.legs.get(this.activeLegIndex)?.ident;

        this.viewListener.triggerToAllSubscribers('A32NX_EFIS_L_TO_WPT_IDENT', efisIdent ?? '');
        this.viewListener.triggerToAllSubscribers('A32NX_EFIS_R_TO_WPT_IDENT', efisIdent ?? '');
    }

    constructor(flightPlanManager: FlightPlanManager, guidanceManager: GuidanceManager) {
        this.guidanceManager = guidanceManager;

        this.lnavDriver = new LnavDriver(this);
        this.vnavDriver = new VnavDriver(this);
        this.pseudoWaypoints = new PseudoWaypoints(this);
        this.efisVectors = new EfisVectors(this);
    }

    init() {
        console.log('[FMGC/Guidance] GuidanceController initialized!');

        this.lnavDriver.ppos.lat = SimVar.GetSimVarValue('PLANE LATITUDE', 'degree latitude');
        this.lnavDriver.ppos.long = SimVar.GetSimVarValue('PLANE LONGITUDE', 'degree longitude');

        this.activeLegIndex = FlightPlanService.activeOrTemporary.activeLegIndex;

        this.updateGeometries();

        this.leftEfisState = { mode: Mode.ARC, range: 10, dataLimitReached: false, legsCulled: false };
        this.rightEfisState = { mode: Mode.ARC, range: 10, dataLimitReached: false, legsCulled: false };
        this.efisStateForSide = {
            L: this.leftEfisState,
            R: this.rightEfisState,
        };

        this.updateEfisState('L', this.leftEfisState);
        this.updateEfisState('R', this.rightEfisState);

        this.efisStateForSide.L = this.leftEfisState;
        this.efisStateForSide.R = this.leftEfisState;

        this.lnavDriver.init();
        this.vnavDriver.init();
        this.pseudoWaypoints.init();

        Coherent.on('A32NX_IMM_EXIT', (fpIndex, immExit) => {
            const leg = this.activeGeometry.legs.get(fpIndex);
            const tas = SimVar.GetSimVarValue('AIRSPEED TRUE', 'Knots');
            if (leg instanceof HMLeg) {
                leg.setImmediateExit(immExit, this.lnavDriver.ppos, tas);
                FlightPlanService.active.incrementVersion();
                this.automaticSequencing = true;
            }
        }, undefined);
    }

    private lastFlightPlanVersion = SimVar.GetSimVarValue(FlightPlanManager.FlightPlanVersionKey, 'number');

    private geometryRecomputationTimer = GEOMETRY_RECOMPUTATION_TIMER + 1;

    update(deltaTime: number) {
        this.geometryRecomputationTimer += deltaTime;

        this.activeLegIndex = FlightPlanService.activeOrTemporary.activeLegIndex;

        this.updateEfisState('L', this.leftEfisState);
        this.updateEfisState('R', this.rightEfisState);

        try {
            // Generate new geometry when flight plan changes
            // const newFlightPlanVersion = FlightPlanService.activeOrTemporary.version;
            // if (newFlightPlanVersion !== this.lastFlightPlanVersion) {
            //     this.lastFlightPlanVersion = newFlightPlanVersion;
            //
            //     this.updateGeometries();
            //     this.geometryRecomputationTimer = 0;
            // }

            if (this.geometryRecomputationTimer > GEOMETRY_RECOMPUTATION_TIMER) {
                this.geometryRecomputationTimer = 0;

                this.updateGeometries();
                // this.recomputeGeometries();
                //
                // if (this.activeGeometry) {
                //     this.vnavDriver.acceptMultipleLegGeometry(this.activeGeometry);
                //     this.pseudoWaypoints.acceptMultipleLegGeometry(this.activeGeometry);
                // }
            }

            this.updateMrpState();
            this.updateMapPartlyDisplayed();

            // Main loop

            this.lnavDriver.update(deltaTime);
            this.vnavDriver.update(deltaTime);
            this.pseudoWaypoints.update(deltaTime);
            this.efisVectors.update(deltaTime);

            this.taskQueue.update(deltaTime);
        } catch (e) {
            console.error('[FMS] Error during tick. See exception below.');
            console.error(e);
        }
    }

    /**
     * Called when the lateral flight plan is changed
     */
    updateGeometries() {
        if (FlightPlanService.has(FlightPlanIndex.Active)) {
            this.updateActiveGeometry();
        }

        if (FlightPlanService.hasTemporary) {
            this.updateTemporaryGeometry();
        }

        if (FlightPlanService.has(FlightPlanIndex.FirstSecondary)) {
            this.updateSecondaryGeometry();
        }

        this.recomputeGeometries();

        this.updateEfisIdent();

        this.geometryRecomputationTimer = 0;
        this.vnavDriver.acceptMultipleLegGeometry(this.activeGeometry);
        this.pseudoWaypoints.acceptMultipleLegGeometry(this.activeGeometry);
    }

    private updateActiveGeometry() {
        if (this.activeGeometry) {
            GeometryFactory.updateFromFlightPlan(this.activeGeometry, FlightPlanService.active);
        } else {
            this.activeGeometry = GeometryFactory.createFromFlightPlan(FlightPlanService.active, this.viewListener);
        }
    }

    private updateTemporaryGeometry() {
        if (this.temporaryGeometry) {
            GeometryFactory.updateFromFlightPlan(this.temporaryGeometry, FlightPlanService.temporary);
        } else {
            this.temporaryGeometry = GeometryFactory.createFromFlightPlan(FlightPlanService.temporary, this.viewListener);
        }
    }

    private updateSecondaryGeometry() {
        if (this.secondaryGeometry) {
            GeometryFactory.updateFromFlightPlan(this.secondaryGeometry, FlightPlanService.secondary(1));
        } else {
            this.secondaryGeometry = GeometryFactory.createFromFlightPlan(FlightPlanService.secondary(1), this.viewListener);
        }
    }

    recomputeGeometries() {
        const tas = SimVar.GetSimVarValue('AIRSPEED TRUE', 'Knots');
        const gs = SimVar.GetSimVarValue('GPS GROUND SPEED', 'Knots');
        const trueTrack = SimVar.GetSimVarValue('GPS GROUND TRACK', 'degrees');

        if (this.activeGeometry) {
            this.activeGeometry.recomputeWithParameters(
                tas,
                gs,
                this.lnavDriver.ppos,
                trueTrack,
                this.activeLegIndex,
                this.activeTransIndex,
            );
        }

        if (this.temporaryGeometry) {
            this.temporaryGeometry.recomputeWithParameters(
                tas,
                gs,
                this.lnavDriver.ppos,
                trueTrack,
                this.activeLegIndex,
                this.activeTransIndex,
            );
        }

        if (this.secondaryGeometry) {
            this.secondaryGeometry.recomputeWithParameters(
                tas,
                gs,
                this.lnavDriver.ppos,
                trueTrack,
                this.activeLegIndex,
                this.activeTransIndex,
            );
        }

        if (this.secondaryGeometry) {
            this.secondaryGeometry.recomputeWithParameters(
                tas,
                gs,
                this.lnavDriver.ppos,
                trueTrack,
                this.activeLegIndex,
                this.activeTransIndex,
            );
        }
    }

    /**
     * Notifies the FMS that a pseudo waypoint must be sequenced.
     *
     * This is to be sued by {@link LnavDriver} only.
     *
     * @param pseudoWaypoint the {@link PseudoWaypoint} to sequence.
     */
    sequencePseudoWaypoint(pseudoWaypoint: PseudoWaypoint): void {
        this.pseudoWaypoints.sequencePseudoWaypoint(pseudoWaypoint);
    }
}
