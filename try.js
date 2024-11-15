let code = "53902";
let reponse = await await await (
    await fetch(`https://api11.stga.fr/saesi-ws/getHoursByStopCode.php?stopCode=${code}`)
).json();
let info = reponse.infos;
let route = reponse.routes;
Bun.write(`./JSON/${code}.json`, JSON.stringify(info) + "\n" + JSON.stringify(route));