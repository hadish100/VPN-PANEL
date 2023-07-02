// ----------- CONFIG -----------

//var HOST_ADDR = "http://localhost:3000";
var HOST_ADDR = "https://panel.gostar.tech";

// ----------- CONFIG -----------

function hl_popup_open()
{
$(".hl_popup_flexor").css("display","flex");
$(".hl_popup_main").css("animation","fadeInDown 0.5s 1");
//$(".hl_popup_main").css("animation","jackInTheBox 1s 1");
$(".hl_popup_bg").css("animation","hl_popup_opacity 0.5s 1");
$(".hl_popup_bg").css("opacity","0.5");
}
function hl_popup_close()
{
$(".hl_popup_bg").css("opacity","0");
$(".hl_popup_main").css("animation","fadeOutDown 0.5s 1");
//$(".hl_popup_main").css("animation","fadeOut 0.5s 1");
setTimeout(function(){
$(".hl_popup_flexor").css("display","none");		
},480);
change_id = 0;
}

