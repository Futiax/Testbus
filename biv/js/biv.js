/**
 * STGA2016      - SI - Frédéric GACON
 * STGA2018-2024 - SI - Jean-Michel MARINO
 */

(function () {
  // configuration de la biv via le fichier config.json
  let bconfig = {};

  // la mise au black de la borne
  let isDisplayUp = true;
  let serverDateTime;

  // gestion de l'affichage des pages horaire
  let page = 1;
  let linePerPage;

  // gestion de l'affichage de la légende dans le pied de page
  // horaire théorique / bus en approche
  let isCaptionTheoricalTime = false;
  let isCaptionBusInApproach = false;

  // gestion de l'affichage des temps d'attente
  // cette variable est mise à jour via le pooling handshake
  // si l'affichage des horaires de la BIV est masqué via l'interface saesi-admin
  // les horaires ne seront pas affichés.
  let isDisplayWaitingTime = true;

  // pour éviter de renouveler une requête alors que la précédente n'est pas terminée
  let isRequestInProgress = false;

  const engine = {
    init() {
      // permet d'afficher les dates/heures au format français
      moment.locale('fr');

      // récupération de la configuration du script
      $.getJSON('config.json')
        .done((data) => {
          bconfig = data;
          $('document').ready(engine.main);
        })
        .fail((jqxhr, textStatus, error) => {
          const err = `${textStatus}, ${error}`;
          console.log(`Request Failed: ${err}`);
        });

      // reset systématique du localstorage
      localStorage.clear();
    },
    main() {
      // debugger;

      // bascule en https + ports appropriés pour atteindre les webservices sur api1.stga.fr
      const currentProtocol = getCurrentProtocol();
      console.log(`protocol ${currentProtocol} enable`)
      if(currentProtocol === "https:") {
        // api1
        bconfig.network.wsEndpointProtocol = bconfig.network.wsEndpointProtocolSSL;
        bconfig.network.wsEndpointPort = bconfig.network.wsEndpointPortSSL;

        // saesi-api
        bconfig.saesiapi.endpointProtocol = bconfig.saesiapi.endpointProtocolSSL;
        bconfig.saesiapi.endpointPort = bconfig.saesiapi.endpointPortSSL;
      }

      // stopCode, provider et options
      let stopCode = getUrlParameter('stopCode');
      const onlyCeccli = getUrlParameter('onlyCeccli');
      const orderBy = getUrlParameter('orderBy');
      if (onlyCeccli == 1) {
        stopCode += '&onlyCeccli=1';
      }
      const wtPerRoute = getUrlParameter('wtPerRoute');

      // nombre de lignes du réseau par page
      linePerPage = getUrlParameter('linePerPage');
      if (!linePerPage) {
        linePerPage = bconfig.display.defaultLinePerPage;
      }

      // enregistrement du hostname de la BIV qui fait référence dans
      // les appels à l'API saesi-api.
      // on en profite également pour récupérer l'ID de la BIV depuis
      // son hostname
      engine.getHostname();

      // et on traite une éventuelle première commande
      engine.getCommand();

      // amorce le scheduler
      engine.scheduler(stopCode, orderBy, wtPerRoute);
    },
    scheduler(stopCode, orderBy, wtPerRoute) {
      console.log('start scheduler');

      engine.getHoursStopCode(stopCode, orderBy, wtPerRoute);
      setInterval(() => {
        //$('#bloc-stopHours').empty();
        engine.getHoursStopCode(stopCode, orderBy, wtPerRoute);
      }, bconfig.display.refreshHours);

      setInterval(() => {
        // période d'exploitation de la borne
        const start = moment(bconfig.display.start, 'HH:mm');
        const end = moment(bconfig.display.end, 'HH:mm');

        if (serverDateTime >= start && serverDateTime <= end) {
          if (isDisplayUp === null || !isDisplayUp) {
            isDisplayUp = true;
            $('#overlay').css({ display: 'none' });
            $('#bloc-stopHours').empty();
            engine.getHoursStopCode(stopCode, orderBy, wtPerRoute);
          }
        } else if (isDisplayUp === null || isDisplayUp) {
          isDisplayUp = false;
          $('#overlay').css({ display: 'block' });
          $('#bloc-stopHours').empty();
          engine.getHoursStopCode(stopCode, orderBy, wtPerRoute);
        }
        console.log(`screensaver isDisplayUp : ${isDisplayUp}`);
      }, bconfig.display.refreshScreensaver);

      setInterval(() => {
        engine.getCommand();
      }, bconfig.command.refreshCheck);

      setInterval(() => {
        engine.handshake(stopCode);
      }, bconfig.handshake.refresh);
    },
    handshake(stopCode) {
      // hostname est-il connu ?
      const hostname = localStorage.getItem('hostname');
      if(hostname == null) {
        engine.getHostname();
      } else {
        const wsURL = new URL('http://localhost');
        wsURL.protocol = bconfig.saesiapi.endpointProtocol;
        wsURL.hostname = bconfig.saesiapi.endpointHostname;
        wsURL.port = bconfig.saesiapi.endpointPort;
        wsURL.pathname = `${bconfig.saesiapi.endpointPathname}handshake/${hostname}`;
  
        const BIVPayload = {          
            "hostname": hostname,
            "stopCode": stopCode
        };
        console.log(JSON.stringify(BIVPayload));

        $.ajax({
          url: wsURL,
          method: 'PATCH',
          contentType: 'application/json',
          dataType: 'json',
          data: JSON.stringify(BIVPayload),
        })
          .done(() => {
            engine.getBIVFromBIVHostname(hostname);
          })
          .fail((jqXHR, textStatus, errorThrown) => {
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
          });
      }
    },
    getHostname() {
      const payload = {
        'UUID': getUID(),
        'name': 'hostname'
      };
      engine.executeCommand(payload)
        .done((response) => {
          console.log(response);

          let hostname = response.data.result.replace(/[\x0A\x0D]/g, '');
          localStorage.setItem('hostname', hostname);
        })
    },
    getBIVFromBIVHostname(hostname) {
      const wsURL = new URL('http://localhost');
      wsURL.protocol = bconfig.saesiapi.endpointProtocol;
      wsURL.hostname = bconfig.saesiapi.endpointHostname;
      wsURL.port = bconfig.saesiapi.endpointPort;
      wsURL.pathname = `${bconfig.saesiapi.endpointPathname}hostname/${hostname}`;

      $.ajax({
        url: wsURL.href,
        type: 'GET',
        dataType: 'json',
        success(response) {
          localStorage.setItem('BIV', JSON.stringify(response.data));
          isDisplayWaitingTime = response.data.status === 'enable';
        },
      });
    },
    getCommand() {
      console.log('getCommand');

      // on récupère toutes les commandes non traitées pour cette BIV

      const BIV = localStorage.getItem('BIV');
      const BIVID = BIV ? JSON.parse(BIV).ID : undefined;
      if (BIVID) {
        const wsURL = new URL('http://localhost');
        wsURL.protocol = bconfig.saesiapi.endpointProtocol;
        wsURL.hostname = bconfig.saesiapi.endpointHostname;
        wsURL.port = bconfig.saesiapi.endpointPort;
        wsURL.pathname = `${
          bconfig.saesiapi.endpointPathname + BIVID
        }/commands`;

        $.ajax({
          url: wsURL.href,
          method: 'POST',
          contentType: 'application/json',
          dataType: 'json',
          data: JSON.stringify({ processed: false }),
        })
          .done((response) => {
            // on ne traite qu'une seule commande
            const bivCommand = response.data[0];
            if (bivCommand) {
              // puis update de cette commande pour ne pas la rejouer
              // ATTENTION : il faut bien update avant execute car le reboot
              // ne permettrait pas de mettre à jour le statut de la commande.

              wsURL.pathname = `${bconfig.saesiapi.endpointPathname}commands/${bivCommand.UUID}`;
              $.ajax({
                url: wsURL.href,
                method: 'PATCH',
              })
                .done((response) => {
                  engine.executeCommand(bivCommand);
                })
                .fail((jqXHR, textStatus, errorThrown) => {
                  console.log(jqXHR);
                  console.log(textStatus);
                  console.log(errorThrown);
                });
            }
          })
          .fail((jqXHR, textStatus, errorThrown) => {
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
          });
      }
    },
    executeCommand(commandPayload) {
      console.log(`executeCommand${JSON.stringify(commandPayload)}`);
      /*        
      {
        "UUID": "0123456789",
        "name": "sudo shutdown",
        "args": "-h now"
      } 
       */

      // construction du payload pour piControl-api
      const command = {};
      command.UUID = commandPayload.UUID;
      command.name = commandPayload.name;
      if (commandPayload.arguments) command.args = commandPayload.arguments;

      const piControlURL = `${bconfig.picontrolapi.endpoint}execute`;

      const exeCmdDefferer = $.Deferred();

      $.ajax({
        url: piControlURL,
        method: 'POST',
        // crossDomain: true,
        contentType: 'application/json',
        dataType: 'json',
        data: JSON.stringify(command),
      })
        .done((response) => {
          exeCmdDefferer.resolve(response);
        })
        .fail((jqXHR, textStatus, errorThrown) => {
          console.log(jqXHR);
          console.log(textStatus);
          console.log(errorThrown);
          exeCmdDefferer.reject(jqXHR, textStatus, errorThrown);
        });

      return exeCmdDefferer.promise();
    },
    getHoursStopCode(stopCode, orderBy, wtPerRoute) {

      // si on souhaite désactiver l'affichage des horaires ce  n'est pas
      // nécessaire de récupérer les horaires en temps réel.
      if(!isDisplayWaitingTime) {
        // mise à jour de la date/heure avec les données locales
        const timestampInSeconds = Math.floor(new Date().getTime() / 1000);
        console.log(timestampInSeconds);

        engine.setDateTime({"datetime":timestampInSeconds});

        // remise à zéro du contenu affiché
        $('#bloc-stopHours').empty();
        return;
      }

      // Si une requête est en cours, ne rien faire
      if (isRequestInProgress) {
        console.log("Une requête est déjà en cours. Attendez la prise en charge.");
        return;
      }

      isRequestInProgress = true;

      const wsParams = {};
      wsParams.stopCode = stopCode;
      wsParams.orderBy = orderBy;
      wsParams.wtPerRoute = wtPerRoute;

      const wsURL = new URL('http://localhost');
      wsURL.protocol = bconfig.network.wsEndpointProtocol;
      wsURL.hostname = bconfig.network.wsEndpointHostname;
      wsURL.port = bconfig.network.wsEndpointPort;
      wsURL.pathname = bconfig.network.wdEndpointPathname;

      $.ajax({
        url: wsURL.href,
        method: 'GET',
        data: wsParams,
      })
        .done((data) => {
          // Marquer que la requête est terminée
          isRequestInProgress = false;

          // console.log(
          //  `[INFO] dataContent: ${JSON.stringify(data)}`
          // );

          // remise à zéro du contenu affiché
          $('#bloc-stopHours').empty();

          if (data.infos[0].error.code == 0) {
            if (data.infos[0].stop != undefined) {
              engine.setHumanStopInfo(data.infos[0].stop);
            } else {
              engine.setError(jqXHR.status, 'ERROR SERVICE DATE');
            }
            if (data.infos[0].timeStamp != undefined) {
              engine.setDateTime(data.infos[0].timeStamp);
            } else {
              engine.setError(jqXHR.status, 'ERROR SERVICE DATE');
            }
            if (data.routes != undefined) {
              engine.parseData(data.routes);
            } else {
              engine.setError(jqXHR.status, 'ERROR SERVICE DATA');
            }
          } else {
            engine.setError(jqXHR.status, 'NO SERVICE');
            console.log(
              `[DEBUG] NO SERVICE dataContent: ${JSON.stringify(data)}`
            );
          }
        })
        .fail((jqXHR, textStatus, errorThrown) => {

          // Marquer que la requête est terminée
          isRequestInProgress = false;

          // remise à zéro du contenu affiché
          $('#bloc-stopHours').empty();

          engine.setError(jqXHR.status, 'ERROR GET DATA');

          if (jqXHR.status == 405) {
            console.log('[getHoursStopCode]- err no service exist !');
          } else {
            console.log(
              `[ERROR] - fct getHoursStopCode http_code: ${
                jqXHR.status
              } Error Obj: ${JSON.stringify(jqXHR)}`
            );
            console.log(`[DEBUG] xhr: ${JSON.stringify(jqXHR)}`);
            console.log(`[DEBUG] textStatus: ${textStatus}`);
            console.log(`[DEBUG] errorThrown: ${errorThrown}`);
            console.log(`[DEBUG] stopCode is: ${stopCode}`);
          }
        });
    },
    setHumanStopInfo(stop) {
      $('#headInfoStop').empty();
      $('#headInfoStop').append(stop.stopCode);

      $('#headStopName').empty();
      $('#headStopName').append(stop.stopName);
    },
    setDateTime(dataTime) {
      serverDateTime = moment.unix(dataTime.datetime);
      console.log(`serverDateTime : ${serverDateTime.format('LT')}`);
      // test avec une date longue ex: Mercredi 14 Novembre 2018"
      // serverDateTime = moment.unix('1542205241');

      $('#headDate').empty();
      $('#headDate').append(
        `${serverDateTime.format('dddd')} ${serverDateTime.format(
          'LL'
        )}`.toUpperCase()
      );

      $('#headTime').empty();
      $('#headTime').append(serverDateTime.format('LT').toUpperCase());
    },
    parseData(routes) {
      nbLine = 0;
      countLine = 1;
      startOffset = 1;
      endOffset = linePerPage;

      if (page > 1) {
        startOffset = linePerPage * page - linePerPage + 1;
        endOffset = startOffset + linePerPage - 1;
      }

      // symbole associé au temps d'attente et notion de clignotement pour
      // les bus en approche

      isCaptionTheoricalTime = false;
      isCaptionBusInApproach = false;
      $('#footerLeft').css('visibility', 'hidden');
      $('#footerRight').css('visibility', 'hidden');

      if (routes[0]) {
        routes[0].forEach((route) => {
          if (countLine >= startOffset && countLine <= endOffset) {
            engine.populateData(
              route.route_short_name,
              route.route_dest,
              route.route_text_color,
              route.route_color,
              route.stopHours,
              route.stopHoursType,
              route.reportStopName
            );
          }

          countLine++;
          nbLine++;
        });
      }

      if (isCaptionTheoricalTime) {
        $('#footerLeft').css('visibility', 'visible');
      }
      if (isCaptionBusInApproach) {
        $('#footerRight').css('visibility', 'visible');
      }

      if (nbLine > linePerPage * page) {
        page++;
      } else {
        page = 1;
      }
    },
    setMessage(msg) {
      $('#headDate').empty();
      $('#headDate').append(msg);
    },
    setError(code, msg) {
      $('#headDate').empty();
      $('#headDate').append(msg);

      $('#headTime').empty();
      $('#headTime').append(code);
    },
    /**
     *
     * Populate data to html for view it
     *
     *
     * @param {type} lineNumber
     * @param {type} lineDest
     * @param {type} lineTxtColor
     * @param {type} lineColor
     * @param {type} lineTime
     * @param {type} HourType
     * @returns {undefined}
     */
    populateData(
      lineNumber,
      lineDest,
      lineTxtColor,
      lineColor,
      lineTime,
      HourType,
      reportStopName
    ) {
      console.log(lineNumber);

      // create html info
      const UUID = getUID();
      $divIdCont = `divContainerStopHour_${UUID}`;
      $divIdFoot = `divFooterStopHour_${UUID}`;

      $('#bloc-stopHours').append(
        `<div id="${$divIdCont}" class="row bloc-hour">`
      );
      $('#bloc-stopHours').append(
        `<div id="${$divIdFoot}" class="row bloc-hr">`
      );

      // taille du numéro de ligne
      $classLine = 'numLigne';
      $classBlinkHourMin = '';
      $timeLeft = Math.round(lineTime / 60) + "'";
      if (lineNumber.length >= 3) {
        $classLine = 'numLigneSmall';
      }

      if (HourType == 'T') {
        if (lineTime > 120) {
          $timeLeft = `*${$timeLeft}`;
          isCaptionTheoricalTime = true;
        }
      }
      /* pour ne pas prendre en compte les arrêt non desservi */
      if ( lineTime <= 120 && !(lineTime == -1) ) {
        $timeLeft = '<<';
        $classBlinkHourMin = 'blink';
        isCaptionBusInApproach = true;
      }

      // POUR DEBUG ARRET PROVISOIRE DE REPORT
      /*
       * lineTime = -1;
       * reportStopName = "ARRÊT provisoire";
       */

      // clignotement pour les arrêts non desservi
      if (lineTime == -1) {
        $timeLeft = '';
        $classBlinkHourMin = '';
        $classDestination = 'blink';
        if (reportStopName) {
          $classVScroll = 'vscroll visible';
        }
      } else {
        // personnalisation de la taille de la destination
        $classDestination = 'destination'
        if (lineDest.length > 28) {
          $classDestination = 'destinationSmall';
        }
      }

      /* afficher heure + minutes si les secondes > 3600 (1 heure) */
      if(lineTime>(60*60)) {
        $timeLeft = moment().add(lineTime, 's').format('HH:mm');
        // c'est forcément un temps théorique, on ajoute donc le symbole étoile devant l'heure de passage
        $timeLeft = `*${$timeLeft}`;
      }

      // **** ATTENTION ****
      //
      // la variable $classRow doit être définie dans le fichier biv.html
      //
      // **** ATTENTION ****

      $(`#${$divIdCont}`).append(
        `<div id="stopHourLine" class="col-${$classRow}-2 ${$classLine}" style="background-color: ${lineColor}; color: ${lineTxtColor};">${lineNumber}</div>`
      );

      // gestion des arrêt de report
      if (reportStopName) {
        $stopReportToID = `stopReportTo_${lineNumber}`;

        $(`#${$divIdCont}`).append(
          `<div id="stopHourDest" class="col-${$classRow}-9 ${$classVScroll}"><div class="visible"><ul id="${$stopReportToID}"></u></div></div>`
        );
        $(`#${$stopReportToID}`).empty();
        $(`#${$stopReportToID}`).append('<li>ARRET NON DESSERVI</li>');
        $(`#${$stopReportToID}`).append('<li>Reportez-vous sur...</li>');
        $(`#${$stopReportToID}`).append(`<li>${reportStopName}</li>`);
      } else {
        $(`#${$divIdCont}`).append(
          `<div id="stopHourDest" class="col-${$classRow}-8 ${$classDestination}">${lineDest}</div>`
        );
      }

      $(`#${$divIdCont}`).append(
        `<div id="stopHourMin_${lineNumber}" class="col-${$classRow}-2 stopHourMin ${$classBlinkHourMin}">${$timeLeft}</div>`
      );
      $(`#${$divIdFoot}`).append(
        `<div id="stopHourColor" class="col-${$classRow}-12" style="background-color: ${lineColor}">&nbsp;</div>`
      );
    },
  };

  engine.init();
})();
