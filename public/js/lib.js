/*--------------------------------------------------------------------------*
 * chromeのフォントサイズ対策
 *--------------------------------------------------------------------------*/
$(function(){
    //chrome用の分岐処理
    var _ua = (function(){
     return {
        Blink:window.chrome
     }
    })();
     
    if(_ua.Blink){
        //chromeの文字サイズ対策
        document.body.style.webkitTransform = "scale(1)";
    }
});