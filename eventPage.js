"use strict";

chrome.app.runtime.onLaunched.addListener(function()
{
	chrome.app.window.create("main.html",
	{
		id: "main-window",
		frame: "chrome",
		innerBounds:
		{
			minWidth: 800,
			minHeight: 720
		}
	},
	function(createdWindow)
	{
		createdWindow.onClosed.addListener(function()
		{
			// Make sure we gracefully disconnect from the device
			// app_window is passed through main.js via chrome.runtime.getBackgroundPage()
			app_window.UI.serialDevice.disconnect();
		});
	});
});
