import { appendFile } from "node:fs/promises";
let istart = (await Bun.file('scan.txt').text()).split('\n').length;
let n = 4
const workerURL = new URL("worker.ts", import.meta.url).href;
for (let j = 1; j< n ; j++){
    const worker = new Worker(workerURL);
    worker.postMessage(`${n};${istart+j}`);
    worker.onerror = (ev) => {
        console.error(`Worker crashed with error: ${ev.message}`)
    }
}
const max = 100000;
let a = performance.now();
for (let i = istart; i < max; i+=n) {
    let code = "0".repeat(5-String(i).length) + String(i) 
    // process.stdout.write('\x1Bc');
    console.log(`duré moyenne d'une itération :${(performance.now()-a)/(1000*(i-istart))}, progression : ${((i+1)*100)/max}%(${i+1}/${max})`);
    await appendFile("scan.txt", `${code}` + " : " + ((await (await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()).infos[0].stop.stopName||"Nothing") + "\n");
}