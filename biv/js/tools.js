/**
 * 
 * http://jsfiddle.net/jadendreamer/Nx4qS/30/
 * 
 * 
 * Purpose: blink a page element
 * Preconditions: the element you want to apply the blink to, the number of times to blink the element (or -1 for infinite times), the speed of the blink
 **/
function blink(elem, times, speed) {
  if (times > 0 || times < 0) {
    if ($(elem).hasClass("blink"))
      $(elem).removeClass("blink");
    else
      $(elem).addClass("blink");
  }

  clearTimeout(function () {
    blink(elem, times, speed);
  });

  if (times > 0 || times < 0) {
    setTimeout(function () {
      blink(elem, times, speed);
    }, speed);
    times -= .5;
  }
}

/**
 * http://stackoverflow.com/questions/19491336/get-url-parameter-jquery-or-how-to-get-query-string-values-in-js
 * http://www.jquerybyexample.net/2012/06/get-url-parameters-using-jquery.html
 * 
 * 
 * @param {type} sParam
 * @returns {getUrlParameter.sParameterName|Boolean}
 */
function getUrlParameter(sParam) {
  var sPageURL = decodeURIComponent(window.location.search.substring(1)),
          sURLVariables = sPageURL.split('&'),
          sParameterName,
          i;

  for (i = 0; i < sURLVariables.length; i++) {
    sParameterName = sURLVariables[i].split('=');

    if (sParameterName[0] === sParam) {
      return sParameterName[1] === undefined ? true : sParameterName[1];
    }
  }
}
;

function getFrenchMonth(monthNumber) {
  //months : 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_'),
  //var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
  var defaultLocaleMonths = 'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'.split('_');

  return defaultLocaleMonths[monthNumber - 1];
}

function getFrenchDay(dayNumber) {
  //weekdays : 
  var defaultLocaleWeekdays = 'dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'.split('_');

  return defaultLocaleWeekdays[dayNumber];

}

function getCurrentProtocol() {
  return window.location.protocol;
}

function getUID() {
  let a = new Uint32Array(3);
  window.crypto.getRandomValues(a);
  return (performance.now().toString(36)+Array.from(a).map(A => A.toString(36)).join("")).replace(/\./g,"");
 };