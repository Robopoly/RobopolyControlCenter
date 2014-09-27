"use strict";

TABS.home = {};
TABS.home.initialize = function(serialDevice)
{
	UI.activeTabReference = this;
	$("#content").load("./tabs/home.html", function()
	{
		
	});
}

TABS.home.cleanup = function()
{

}
