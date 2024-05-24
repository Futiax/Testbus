console.log("Loading worker")
self.addEventListener("message", event => {
    let [n, istart] = event.data.split(";");
    console.log("Spawned worker with id " + istart)
    n = parseInt(n), istart = parseInt(istart);
    main(n, istart);
});



function main(n, istart) {
    import { appendFile } from "node:fs/promises";
    const max = 100000;
    for (let i = istart; i < max; i+=n) {
        let code = "0".repeat(5-String(i).length) + String(i)
        await appendFile("scan.txt", `${code}` + " : " + ((await (await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()).infos[0].stop.stopName||"Nothing") + "\n");
    }
}