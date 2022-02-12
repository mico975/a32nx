function airplaneCanBoard() {
    const busDC2 = SimVar.GetSimVarValue("L:A32NX_ELEC_DC_2_BUS_IS_POWERED", "Bool");
    const busDCHot1 = SimVar.GetSimVarValue("L:A32NX_ELEC_DC_HOT_1_BUS_IS_POWERED", "Bool");
    const gs = SimVar.GetSimVarValue("GPS GROUND SPEED", "knots");
    const isOnGround = SimVar.GetSimVarValue("SIM ON GROUND", "Bool");
    const eng1Running = SimVar.GetSimVarValue("ENG COMBUSTION:1", "Bool");
    const eng2Running = SimVar.GetSimVarValue("ENG COMBUSTION:2", "Bool");

    return !(gs > 0.1 || eng1Running || eng2Running || !isOnGround || (!busDC2 && !busDCHot1));
}

class A32NX_Boarding {
    constructor() {
        this.boardingState = "finished";
        this.time = 0;
        const payloadConstruct = new A32NX_PayloadConstructor();
        this.paxStations = payloadConstruct.paxStations;
        this.cargoStations = payloadConstruct.cargoStations;
    }

    async init() {
        // Set default pax (0)
        console.log("INITIALIZING A32NX_Boarding.js!");
        const pax = SimVar.GetSimVarValue("L:A32NX_INITIAL_PAX", "number");
        const cargo = SimVar.GetSimVarValue("L:A32NX_INITIAL_CARGO", "number");
        await this.setPax(pax);
        await this.loadPaxPayload();
        await this.setCargo(pax, cargo);
        await this.loadCargoPayload();
    }

    async fillPaxStation(station, paxToFill) {
        const pax = Math.min(paxToFill, station.seats);
        station.pax = pax;
        await SimVar.SetSimVarValue(`L:${station.simVar}`, "Number", pax);
    }

    async fillCargoStation(station, loadToFill) {
        station.load = loadToFill;
        await SimVar.SetSimVarValue(`L:${station.simVar}`, "Number", parseInt(loadToFill));
    }

    async setPax(numberOfPax) {
        let paxRemaining = parseInt(numberOfPax);

        async function fillStation(station, percent, paxToFill) {
            const pax = Math.min(Math.trunc(percent * paxToFill), station.seats);
            station.pax = pax;
            await SimVar.SetSimVarValue(`L:${station.simVar}_DESIRED`, "Number", parseInt(pax));
            paxRemaining -= pax;
        }

        await fillStation(paxStations['rows22_29'], .28 , numberOfPax);
        await fillStation(paxStations['rows14_21'], .28, numberOfPax);
        await fillStation(paxStations['rows7_13'], .25 , numberOfPax);
        await fillStation(paxStations['rows1_6'], 1 , paxRemaining);
    }

    async setCargo(numberOfPax, otherCargo) {
        const bagWeight = numberOfPax * 20;
        const maxTotalPayload = 21800; // from flight_model.cfg
        let loadableCargoWeight;

        if (otherCargo === 0) {
            loadableCargoWeight = bagWeight;
        } else if ((otherCargo + bagWeight + (numberOfPax * PAX_WEIGHT)) > maxTotalPayload) {
            loadableCargoWeight = maxTotalPayload - (numberOfPax * PAX_WEIGHT);
        } else {
            loadableCargoWeight = otherCargo + bagWeight;
        }
        let remainingWeight = loadableCargoWeight;

        async function fillCargo(station, percent, loadableCargoWeight) {
            const weight = Math.round(percent * loadableCargoWeight);
            station.load = weight;
            remainingWeight -= weight;
            await SimVar.SetSimVarValue(`L:${station.simVar}_DESIRED`, "Number", weight);
        }

        await fillCargo(cargoStations['fwdBag'], .361 , loadableCargoWeight);
        await fillCargo(cargoStations['aftBag'], .220, loadableCargoWeight);
        await fillCargo(cargoStations['aftCont'], .251, loadableCargoWeight);
        await fillCargo(cargoStations['aftBulk'], 1, remainingWeight);
    }

    async loadPaxPayload() {
        for (const paxStation of Object.values(this.paxStations)) {
            await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${paxStation.stationIndex}`, "kilograms", paxStation.pax * PAX_WEIGHT);
        }
    }

    async loadCargoPayload() {
        for (const loadStation of Object.values(this.cargoStations)) {
            await SimVar.SetSimVarValue(`PAYLOAD STATION WEIGHT:${loadStation.stationIndex}`, "kilograms", loadStation.load);
        }
    }

    async update(_deltaTime) {
        this.time += _deltaTime;

        const boardingStartedByUser = SimVar.GetSimVarValue("L:A32NX_BOARDING_STARTED_BY_USR", "Bool");
        const boardingRate = NXDataStore.get("CONFIG_BOARDING_RATE", 'REAL');

        if (!boardingStartedByUser) {
            return;
        }

        if ((!airplaneCanBoard() && boardingRate === 'REAL') || (!airplaneCanBoard() && boardingRate === 'FAST')) {
            return;
        }

        const currentPax = Object.values(this.paxStations).map((station) => SimVar.GetSimVarValue(`L:${station.simVar}`, "Number")).reduce((acc, cur) => acc + cur);
        const paxTarget = Object.values(this.paxStations).map((station) => SimVar.GetSimVarValue(`L:${station.simVar}_DESIRED`, "Number")).reduce((acc, cur) => acc + cur);
        const currentLoad = Object.values(this.cargoStations).map((station) => SimVar.GetSimVarValue(`L:${station.simVar}`, "Number")).reduce((acc, cur) => acc + cur);
        const loadTarget = Object.values(this.cargoStations).map((station) => SimVar.GetSimVarValue(`L:${station.simVar}_DESIRED`, "Number")).reduce((acc, cur) => acc + cur);

        let isAllPaxStationFilled = true;
        for (const _station of Object.values(this.paxStations)) {
            const stationCurrentPax = SimVar.GetSimVarValue(`L:${_station.simVar}`, "Number");
            const stationCurrentPaxTarget = SimVar.GetSimVarValue(`L:${_station.simVar}_DESIRED`, "Number");

            if (stationCurrentPax !== stationCurrentPaxTarget) {
                isAllPaxStationFilled = false;
                break;
            }
        }

        let isAllCargoStationFilled = true;
        for (const _station of Object.values(this.cargoStations)) {
            const stationCurrentLoad = SimVar.GetSimVarValue(`L:${_station.simVar}`, "Number");
            const stationCurrentLoadTarget = SimVar.GetSimVarValue(`L:${_station.simVar}_DESIRED`, "Number");

            if (stationCurrentLoad !== stationCurrentLoadTarget) {
                isAllCargoStationFilled = false;
                break;
            }
        }

        if (currentPax === paxTarget && currentLoad === loadTarget && isAllPaxStationFilled && isAllCargoStationFilled) {
            // Finish boarding
            this.boardingState = "finished";
            await SimVar.SetSimVarValue("L:A32NX_BOARDING_STARTED_BY_USR", "Bool", false);

        } else if ((currentPax < paxTarget) || (currentLoad < loadTarget)) {
            this.boardingState = "boarding";
        } else if ((currentPax === paxTarget) && (currentLoad === loadTarget)) {
            this.boardingState = "finished";
        }

        if (boardingRate === 'INSTANT') {
            // Instant
            for (const paxStation of Object.values(this.paxStations)) {
                const stationCurrentPaxTarget = SimVar.GetSimVarValue(`L:${paxStation.simVar}_DESIRED`, "Number");
                await this.fillPaxStation(paxStation, stationCurrentPaxTarget);
            }
            for (const loadStation of Object.values(this.cargoStations)) {
                const stationCurrentLoadTarget = SimVar.GetSimVarValue(`L:${loadStation.simVar}_DESIRED`, "Number");
                await this.fillCargoStation(loadStation, stationCurrentLoadTarget);
            }
            await this.loadPaxPayload();
            await this.loadCargoPayload();
            return;
        }

        let msDelay = 5000;
        if (boardingRate === 'FAST') {
            msDelay = 1000;
        } else if (boardingRate === 'REAL') {
            msDelay = 5000;
        }

        if (this.time > msDelay) {
            this.time = 0;

            // Stations logic:
            for (const paxStation of Object.values(this.paxStations).reverse()) {
                const stationCurrentPax = SimVar.GetSimVarValue(`L:${paxStation.simVar}`, "Number");
                const stationCurrentPaxTarget = SimVar.GetSimVarValue(`L:${paxStation.simVar}_DESIRED`, "Number");

                if (stationCurrentPax < stationCurrentPaxTarget) {
                    await this.fillPaxStation(paxStation, stationCurrentPax + 1);
                    break;
                } else if (stationCurrentPax > stationCurrentPaxTarget) {
                    await this.fillPaxStation(paxStation, stationCurrentPax - 1);
                    break;
                }
            }

            for (const loadStation of Object.values(this.cargoStations)) {
                const stationCurrentLoad = SimVar.GetSimVarValue(`L:${loadStation.simVar}`, "Number");
                const stationCurrentLoadTarget = SimVar.GetSimVarValue(`L:${loadStation.simVar}_DESIRED`, "Number");

                if ((stationCurrentLoad < stationCurrentLoadTarget) && (Math.abs((stationCurrentLoadTarget - stationCurrentLoad)) > 40)) {
                    await this.fillCargoStation(loadStation, stationCurrentLoad + 40);
                    break;
                } else if ((stationCurrentLoad < stationCurrentLoadTarget) && (Math.abs((stationCurrentLoadTarget - stationCurrentLoad)) <= 40)) {
                    await this.fillCargoStation(loadStation, (stationCurrentLoad + (Math.abs(stationCurrentLoadTarget - stationCurrentLoad))));
                    break;
                } else if ((stationCurrentLoad > stationCurrentLoadTarget) && (Math.abs((stationCurrentLoadTarget - stationCurrentLoad)) > 40)) {
                    await this.fillCargoStation(loadStation, stationCurrentLoad - 40);
                    break;
                } else if ((stationCurrentLoad > stationCurrentLoadTarget) && (Math.abs((stationCurrentLoadTarget - stationCurrentLoad)) <= 40)) {
                    await this.fillCargoStation(loadStation, (stationCurrentLoad - (Math.abs(stationCurrentLoad - stationCurrentLoadTarget))));
                    break;
                }
            }

            await this.loadPaxPayload();
            await this.loadCargoPayload();
        }
    }
}