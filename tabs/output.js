"use strict";

TABS.output = {};
TABS.output.initialize = function(serialDevice)
{
	this.serialDevice = serialDevice;
	this.nextUpdate = false;
	this.buffer = "";
	this.fields = [
		"d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d10", "d11", "d12", "d13",
		"miso", "sck", "mosi", "ss",
		"da0", "da1", "da2", "da3", "da4", "da5",
		"a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11",
		"m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13",
		"mmiso", "msck", "mmosi", "mss",
		"ma0", "ma1", "ma2", "ma3", "ma4", "ma5",
		"temperature"];
	this.fieldCounter = 0;

	// To output temperature values in C the sensor needs to be calibrated
	this.tempGain = 1;
	this.tempOffset = -273;

	var self = this;

	UI.activeTabReference = this;
	$("#content").load("./tabs/output.html", function()
	{
		document.getElementById("updatePeriod").oninput = function()
		{
			$(this).next("span").html(this.value);
		};

		$("#shield").change(function()
		{
			if(this.checked)
			{
				$("#image").attr("src", "./images/shield.png");
			}
			else
			{
				$("#image").attr("src", "./images/prismino.png");
			}
		});

		// Add listener to incoming data
		self.serialDevice.addListener(function(data)
		{
			self.read(data);
		});

		// Start update loop
		self.update();
	});
}

TABS.output.read = function(info)
{
	// Got some data from the connected device
	var data = new Uint8Array(info.data);

	for(var i = 0; i < data.length; i++)
	{
		switch(data[i])
		{
			case 103: // g
				// Beginning
				this.buffer = "";
				this.fieldCounter = 0;
				break;
			case 10: // line feed
				// Some conversion is needed for temperature measurement
				if(this.fields[this.fieldCounter] == "temperature")
				{
					this.buffer = (parseInt(this.buffer) + this.tempOffset) * this.tempGain;
				}

				if(this.fieldCounter > 35)
				{
					switch(this.buffer)
					{
						case "0": this.buffer = "Input"; break;
						case "1": this.buffer = "Output"; break;
						case "2": this.buffer = "Pull-up"; break;
					}
				}

				$("#" + this.fields[this.fieldCounter]).html(this.buffer);
				this.fieldCounter++;
				this.buffer = "";
				break;
			default:
				this.buffer += String.fromCharCode(data[i]);
		}
	}
}

TABS.output.update = function()
{
	this.serialDevice.send("g");

	if(!this.nextUpdate)
	{
		var self = this;
		this.nextUpdate = window.setTimeout(function()
		{
			self.nextUpdate = false;
			self.update();
		}, parseInt($("#updatePeriod").val()));
	}
}

TABS.output.cleanup = function()
{
	if(this.nextUpdate)
	{
		window.clearTimeout(this.nextUpdate);
	}
}
