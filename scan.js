import { appendFile } from "node:fs/promises";
let istart = (await Bun.file('scan.txt').text()).split('\n').length;
let n = 8
const workerURL = new URL("worker.ts", import.meta.url).href;
for (let j = 1; j< n ; j++){
    const worker = new Worker(workerURL);
    worker.postMessage(`${n};${istart+j}`);
    worker.onerror = async (ev) => {
        await appendFile("log.txt", `Worker crashed with error: ${ev.message}`)
    }
}
const max = 100000;
let a = performance.now();
for (let i = istart; i < max; i+=n) {
    let code = "0".repeat(5-String(i).length) + String(i) 
    process.stdout.write('\x1Bc');
    let tempmoy =  (performance.now()-a)/(i-istart)
    console.log(`duré moyenne d'une itération: ${tempmoy}ms\nprogression : ${((i+1)*100)/max}%\nTemps restant estimé : ${(Math.floor(tempmoy*(max-i)/60000))}min${(Math.round(tempmoy*(max-i)%60000))/1000}`);
    await appendFile(
        "scan.txt",
        `${code}` +
            " : " +
            ((
                await (await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)).json()
            ).infos[0] || "Nothing") +
            "\n"
    );
}