class A32NX_StateInitializer {
    constructor() {
        this.autobrakeLevel = null;
        this.useManagedSpeed = null;
        this.selectedSpeed = null;
        this.selectedAlt = null;
    }

    init() {
        this.autobrakeLevel = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_AUTOBRK_LVL", "Number");
        this.useManagedSpeed = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_USE_MANAGED_SPEED", "Number");
        this.selectedSpeed = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_SPEED", "Number");
        this.selectedAlt = Math.max(2000, SimVar.GetSimVarValue("L:A32NX_STATE_INIT_SELECTED_ALT", "Number"));
    }

    update() {
        const active = SimVar.GetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool");
        if (active === 1) {
            SimVar.SetSimVarValue("K:FREEZE_LATITUDE_LONGITUDE_SET", "number", 1);
            SimVar.SetSimVarValue("K:FREEZE_ALTITUDE_SET", "number", 1);
            SimVar.SetSimVarValue("K:FREEZE_ATTITUDE_SET", "number", 1);

            const athr = SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_STATUS", "Number");

            if (athr === 0) {
                if (this.autobrakeLevel === 1) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_LOW_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_LOW_ON_IS_PRESSED", "Number", 0);
                    });
                } else if (this.autobrakeLevel === 2) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MED_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MED_ON_IS_PRESSED", "Number", 0);
                    });
                } else if (this.autobrakeLevel === 3) {
                    SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MAX_ON_IS_PRESSED", "Number", 1).then(() => {
                        SimVar.SetSimVarValue("L:A32NX_OVHD_AUTOBRK_MAX_ON_IS_PRESSED", "Number", 0);
                    });
                }

                // Toggle FD's off for landing challenges
                SimVar.SetSimVarValue("K:TOGGLE_FLIGHT_DIRECTOR", number, 1);
                SimVar.SetSimVarValue("K:TOGGLE_FLIGHT_DIRECTOR", number, 2);
                // Set V2 Speed to allow managed speed mode to be enabled
                SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "knots", 140);
                // Set go-around altitude
                SimVar.SetSimVarValue("K:3:AP_ALT_VAR_SET_ENGLISH", "number", this.selectedAlt);
                // Set throttles to TOGA temporarily, to arm A/THR (since A/THR pushbutton event is inconsistent)
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 45);
                SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:2", "Number", 45);
            } else if (athr === 1) {
                // Pull throttles back to climb detent and set managed/selected speed
                this.setClimbThrust().then(() => {
                    if (this.useManagedSpeed === 1) {
                        SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PUSH", "Number", 1).then(() => {
                            console.log("A32NX_StateInitializer: Set managed speed.");
                        });
                    } else {
                        SimVar.SetSimVarValue("L:A320_Neo_FCU_SPEED_SET_DATA", "Number", this.selectedSpeed).then(() => {
                            SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_SET", "Number", 1).then(() => {
                                SimVar.SetSimVarValue("H:A320_Neo_FCU_SPEED_PULL", "Number", 1).then(() => {
                                    console.log("A32NX_StateInitializer: Finished setting all speed variables.");
                                });
                            });
                        });
                    }
                });
            } else if (
                athr === 2
                && SimVar.GetSimVarValue("L:A32NX_AUTOTHRUST_MODE", "Number") === 7
                && ((this.useManagedSpeed === 0 && SimVar.GetSimVarValue("L:A32NX_AUTOPILOT_SPEED_SELECTED", "Number") === this.selectedSpeed)
                    || (this.useManagedSpeed === 1 && SimVar.GetSimVarValue("L:A32NX_FCU_SPD_MANAGED_DASHES", "Number") === 1))
            ) {
                SimVar.SetSimVarValue("L:A32NX_STATE_INIT_ACTIVE", "Bool", 0);
                SimVar.SetSimVarValue("K:FREEZE_LATITUDE_LONGITUDE_TOGGLE", "number", 1);
                SimVar.SetSimVarValue("K:FREEZE_ALTITUDE_TOGGLE", "number", 1);
                SimVar.SetSimVarValue("K:FREEZE_ATTITUDE_TOGGLE", "number", 1);
            }
        }
    }

    async setClimbThrust() {
        await SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:1", "Number", 25);
        await SimVar.SetSimVarValue("L:A32NX_AUTOTHRUST_TLA:2", "Number", 25);
    }
}
