import { appendFile } from "node:fs/promises";
const istart = (await Bun.file('scan.txt').text()).split('\n').length;
if (istart%2 == 1){
    istart -=1
}
const workerURL = new URL("worker.ts", import.meta.url).href;
const worker = new Worker(workerURL);
let a = performance.now()
const max = 100000;

for (let i = istart; i < max; i++) {
    let code = "0".repeat(5-String(i).length) + String(i) 
    process.stdout.write('\x1Bc');
    console.log(`vitesse :${(performance.now()-a)/(1000*(i-istart))}, progression : ${i+1}/${max}`);
    await appendFile("scan.txt", `${code}` + " : " + ((await (await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()).infos[0].stop.stopName||"Nothing") + "\n");
}