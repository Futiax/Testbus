import { appendFile } from "node:fs/promises";
for (let i = 19089; i < 100000; i++) {
    let code = "0".repeat(5-String(i).length) + String(i) 
    console.log(code)
    await appendFile("scan.txt", `${code}` + ": " + (await (await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()).infos[0].stop.stopName + "\n");
}