import { appendFile } from "node:fs/promises";
self.addEventListener("message", (event) => {
    let [n, istart] = event.data.split(";");
    (n = parseInt(n)), (istart = parseInt(istart));
    main(n, istart);
});

async function main(n, istart) {
    const max = 100000;
    for (let i = istart; i < max; i += n) {
        let code = "0".repeat(5 - String(i).length) + String(i);
        let reponse = await await await (
            await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)
        ).json();
        let info = reponse.infos;
        let route = reponse.routes;
        Bun.write(`./JSON/${code}.json`, JSON.stringify(info) + "\n" + JSON.stringify(route));
    }
}
