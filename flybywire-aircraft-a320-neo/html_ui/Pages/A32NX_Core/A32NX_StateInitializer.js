class A32NX_StateInitializer {
    constructor(flightPhaseManager) {
        this.flightPhaseManager = flightPhaseManager;
        this.useManagedSpeed = null;
        this.selectedSpeed = null;
        this.selectedAlt = null;
        this.hasUnfrozen = null;
        this.pushedTRK = null;

        this.loadmap = {
            "L:A32NX_STATE_INIT_PAX_ROWS_1_6": 1,
            "L:A32NX_STATE_INIT_PAX_ROWS_7_13": 2,
            "L:A32NX_STATE_INIT_PAX_ROWS_14_21": 3,
            "L:A32NX_STATE_INIT_PAX_ROWS_22_29": 4,
            "L:A32NX_STATE_INIT_CARGO_FWD_BAGGAGE_CONTAINER": 5,
            "L:A32NX_STATE_INIT_CARGO_AFT_CONTAINER": 6,
            "L:A32NX_STATE_INIT_CARGO_AFT_BAGGAGE": 7,
            "L:A32NX_STATE_INIT_CARGO_AFT_BULK_LOOSE": 8,
        };
    }

    init() {
        this.useManagedSpeed = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_USE_MANAGED_SPEED", "Number");
        this.selectedSpeed = Math.max(140, SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_SPEED", "Number"));
        this.selectedAlt = Math.max(2000, SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_ALT", "Number"));
        this.hasUnfrozen = false;
        this.pushedTRK = false;
    }

    async update() {
        if (SimVar.GetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool") !== 1) {
            return;
        }

        const ll_freeze_active = SimVar.GetSimVarValue("IS LATITUDE LONGITUDE FREEZE ON", "bool") === 1;
        const alt_freeze_active = SimVar.GetSimVarValue("IS ALTITUDE FREEZE ON", "bool") === 1;
        const att_freeze_active = SimVar.GetSimVarValue("IS ATTITUDE FREEZE ON", "bool") === 1;
        const all_freezes_active = ll_freeze_active && alt_freeze_active && att_freeze_active;

        const fd1_active = SimVar.GetSimVarValue("AUTOPILOT FLIGHT DIRECTOR ACTIVE:1", "bool") === 1;
        const fd2_active = SimVar.GetSimVarValue("AUTOPILOT FLIGHT DIRECTOR ACTIVE:2", "bool") === 1;
        const all_fd_active = fd1_active && fd2_active;

        if (!ll_freeze_active) {
            await SimVar.SetSimVarValue("K:FREEZE_LATITUDE_LONGITUDE_SET", "number", 1);
        }
        if (!alt_freeze_active) {
            await SimVar.SetSimVarValue("K:FREEZE_ALTITUDE_SET", "number", 1);
        }
        if (!att_freeze_active) {
            await SimVar.SetSimVarValue("K:FREEZE_ATTITUDE_SET", "number", 1);
        }

        if (fd1_active) {
            await SimVar.SetSimVarValue("K:TOGGLE_FLIGHT_DIRECTOR", "number", 1);
        }
        if (fd2_active) {
            await SimVar.SetSimVarValue("K:TOGGLE_FLIGHT_DIRECTOR", "number", 2);
        }

        if (all_freezes_active && !all_fd_active && SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_STATUS", "Number") === 0) {
            await this.setThrustLevers(45);
        }

        if (SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_STATUS", "Number") === 1) {
            await this.setThrustLevers(25);

            if (this.useManagedSpeed === 1) {
                await SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "knots", 140);
            } else {
                await SimVar.SetSimVarValue("K:A32NX.FCU_SPD_PULL", "number", 0);
                await SimVar.SetSimVarValue("K:A32NX.FCU_SPD_SET", "number", this.selectedSpeed);
            }
        }

        if (
            SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_STATUS", "Number") === 2
            && ((this.useManagedSpeed === 0 && SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_MODE", "Number") === 7 && SimVar.GetSimVarValue("L:A32NX_AUTOPILOT_SPEED_SELECTED", "Number") === this.selectedSpeed)
            || this.useManagedSpeed === 1)
        ) {
            this.flightPhaseManager.changeFlightPhase(FmgcFlightPhases.APPROACH);
            if (this.useManagedSpeed === 1) {
                await SimVar.SetSimVarValue("K:A32NX.FCU_SPD_PUSH", "number", 1);
            }

            // Enable TRK/FPA mode
            if (!this.pushedTRK && SimVar.GetSimVarValue("L:A32NX_TRK_FPA_MODE_ACTIVE", "number") === 0) {
                SimVar.SetSimVarValue("K:A32NX.FCU_TRK_FPA_TOGGLE_PUSH", "number", 1);
                this.pushedTRK = true;
            }

            // Set load values
            for (const [loadvar, i] of Object.entries(this.loadmap)) {
                const initLoadValue = SimVar.GetSimVarValue(loadvar, "kilograms");
                if (SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, "kilograms") !== initLoadValue) {
                    SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${i}`, "kilograms", initLoadValue);
                }
            }

            // Unfreeze aircraft
            if (!this.hasUnfrozen) {
                if (ll_freeze_active) {
                    SimVar.SetSimVarValue("K:FREEZE_LATITUDE_LONGITUDE_TOGGLE", "number", 1);
                }
                if (alt_freeze_active) {
                    SimVar.SetSimVarValue("K:FREEZE_ALTITUDE_TOGGLE", "number", 1);
                }
                if (att_freeze_active) {
                    SimVar.SetSimVarValue("K:FREEZE_ATTITUDE_TOGGLE", "number", 1);
                }
                this.hasUnfrozen = true;
            }

            // Remove GPS PRIMARY message from ND
            if (SimVar.GetSimVarValue("L:A32NX_EFIS_L_ND_FM_MESSAGE_FLAGS", "number") !== 0) {
                SimVar.SetSimVarValue("L:A32NX_EFIS_L_ND_FM_MESSAGE_FLAGS", "number", 0);
            }
            if (SimVar.GetSimVarValue("L:A32NX_EFIS_R_ND_FM_MESSAGE_FLAGS", "number") !== 0) {
                SimVar.SetSimVarValue("L:A32NX_EFIS_R_ND_FM_MESSAGE_FLAGS", "number", 0);
            }

            // Prevent this loop from running again if everything is complete
            SimVar.SetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool", 0);
        }
    }

    async setThrustLevers(tlaPercent) {
        await Promise.all([
            SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", tlaPercent),
            SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:2", "Number", tlaPercent)
        ]);
        return;
    }
}
