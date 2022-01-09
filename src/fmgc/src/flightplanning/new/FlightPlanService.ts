// Copyright (c) 2021-2022 FlyByWire Simulations
// Copyright (c) 2021-2022 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanIndex, FlightPlanManager } from '@fmgc/flightplanning/new/FlightPlanManager';
import { A380FpmConfig, FpmConfig } from '@fmgc/flightplanning/new/FpmConfig';

export class FlightPlanService {
    private constructor() {
    }

    static flightPlanManager = new FlightPlanManager();

    private static config: FpmConfig = A380FpmConfig

    static version = 0;

    static get active() {
        return this.flightPlanManager.get(FlightPlanIndex.Active);
    }

    static get activeOrTemporary() {
        if (this.hasTemporary) {
            return this.flightPlanManager.get(FlightPlanIndex.Temporary);
        }
        return this.flightPlanManager.get(FlightPlanIndex.Active);
    }

    /**
     * Obtains the specified secondary flight plan, 1-indexed
     */
    static secondary(index: number) {
        return this.flightPlanManager.get(FlightPlanIndex.FirstSecondary + index - 1);
    }

    static get hasTemporary() {
        return this.flightPlanManager.has(FlightPlanIndex.Temporary);
    }

    static temporaryInsert() {
        this.flightPlanManager.copy(FlightPlanIndex.Temporary, FlightPlanIndex.Active);
        this.flightPlanManager.delete(FlightPlanIndex.Temporary);
    }

    static temporaryDelete() {
        if (!this.hasTemporary) {
            throw new Error('[FMS/FPS] Cannot delete temporary flight plan if none exists');
        }

        this.flightPlanManager.delete(FlightPlanIndex.Temporary);
    }

    private static prepareDestructiveModification(planIndex: FlightPlanIndex) {
        let finalIndex = planIndex;
        if (planIndex < FlightPlanIndex.FirstSecondary) {
            this.ensureTemporaryExists();

            finalIndex = FlightPlanIndex.Temporary;
        }

        return finalIndex;
    }

    /**
     * Resets the flight plan with a new FROM/TO/ALTN city pair
     *
     * @param fromIcao  ICAO of the FROM airport
     * @param toIcao    ICAO of the TO airport
     * @param altnIcao  ICAO of the ALTN airport
     * @param planIndex which flight plan (excluding temporary) to make the change on
     */
    static async newCityPair(fromIcao: string, toIcao: string, altnIcao?: string, planIndex = FlightPlanIndex.Active) {
        if (planIndex === FlightPlanIndex.Temporary) {
            throw new Error('[FMS/FPM] Cannot enter new city pair on temporary flight plan');
        }

        if (planIndex === FlightPlanIndex.Active && this.flightPlanManager.has(FlightPlanIndex.Temporary)) {
            this.flightPlanManager.delete(FlightPlanIndex.Temporary);
        }

        if (this.flightPlanManager.has(planIndex)) {
            this.flightPlanManager.delete(planIndex);
        }
        this.flightPlanManager.create(planIndex);

        await this.flightPlanManager.get(planIndex).setOriginAirport(fromIcao);
        await this.flightPlanManager.get(planIndex).setDestinationAirport(toIcao);
        if (altnIcao) {
            await this.flightPlanManager.get(planIndex).setAlternateDestinationAirport(altnIcao);
        }
    }

    /**
     * Sets the origin runway in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param runwayIdent the runway identifier (e.g., RW27C)
     * @param planIndex   which flight plan to make the change on
     */
    static setOriginRunway(runwayIdent: string, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setOriginRunway(runwayIdent);
    }

    /**
     * Sets the departure procedure in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param procedureIdent the procedure identifier (e.g., BAVE6P)
     * @param planIndex      which flight plan to make the change on
     */
    static setDepartureProcedure(procedureIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setDeparture(procedureIdent);
    }

    /**
     * Sets the departure enroute transition procedure in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param transitionIdent the enroute transition identifier (e.g., KABIN)
     * @param planIndex       which flight plan to make the change on
     */
    static setDepartureEnrouteTransition(transitionIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setDepartureEnrouteTransition(transitionIdent);
    }

    /**
     * Sets the arrival enroute transition procedure in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param transitionIdent the enroute transition identifier (e.g., PLYMM)
     * @param planIndex       which flight plan to make the change on
     */
    static setArrivalEnrouteTransition(transitionIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setArrivalEnrouteTransition(transitionIdent);
    }

    /**
     * Sets the arrival procedure in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param procedureIdent the procedure identifier (e.g., BOXUM5)
     * @param planIndex      which flight plan to make the change on
     */
    static setArrival(procedureIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setArrival(procedureIdent);
    }

    /**
     * Sets the approach via in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param procedureIdent the procedure identifier (e.g., DIREX)
     * @param planIndex      which flight plan to make the change on
     */
    static setApproachVia(procedureIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setApproachVia(procedureIdent);
    }

    /**
     * Sets the approach procedure in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param procedureIdent the procedure identifier (e.g., R05-X)
     * @param planIndex      which flight plan to make the change on
     */
    static setApproach(procedureIdent: string | undefined, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setApproach(procedureIdent);
    }

    /**
     * Sets the origin runway in the flight plan. Creates a temporary flight plan if target is active.
     *
     * @param runwayIdent the runway identifier (e.g., RW27C)
     * @param planIndex   which flight plan to make the change on
     */
    static setDestinationRunway(runwayIdent: string, planIndex = FlightPlanIndex.Active) {
        const finalIndex = this.prepareDestructiveModification(planIndex);

        return this.flightPlanManager.get(finalIndex).setDestinationRunway(runwayIdent);
    }

    /**
     * Deletes an element (leg or discontinuity) at the specified index. Depending on the {@link FpmConfig} in use,
     * this can create a temporary flight plan if target is active.
     *
     * @param index     the index of the element to delete
     * @param planIndex which flight plan to make the change on
     *
     * @returns `true` if the element could be removed, `false` if removal is not allowed
     */
    static deleteElementAt(index: number, planIndex = FlightPlanIndex.Active): boolean {
        if (!this.config.ALLOW_REVISIONS_ON_TMPY && planIndex === FlightPlanIndex.Temporary) {
            throw new Error('[FMS/FPS] Cannot delete element in temporary flight plan');
        }

        let finalIndex: number = planIndex;
        if (this.config.TMPY_ON_DELETE_WAYPOINT) {
            finalIndex = this.prepareDestructiveModification(planIndex);
        }

        return this.flightPlanManager.get(finalIndex).removeElementAt(index);
    }

    private static ensureTemporaryExists() {
        if (this.hasTemporary) {
            return;
        }

        this.flightPlanManager.copy(FlightPlanIndex.Active, FlightPlanIndex.Temporary);
    }
}
