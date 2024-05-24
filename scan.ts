import { appendFile } from "node:fs/promises";
for (let i = 19089; i < 100000; i++) {
    let a = performance.now()
    let code = "0".repeat(5-String(i).length) + String(i) 
    console.log(code)
    await appendFile("scan.txt", `${code}` + ": " + (await (await fetch(`https://futiax.deno.dev/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()).infos[0].stop.stopName + "\n");
    await Bun.sleep(550-(performance.now()-a))
}