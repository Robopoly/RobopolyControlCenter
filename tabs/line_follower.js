"use strict";

TABS.line_follower = {};
TABS.line_follower.initialize = function(serialDevice)
{
	this.serialDevice = serialDevice;
	this.nextUpdate = false;
	this.buffer = "";
	this.fields = ["d0", "da0", "d1", "da1"];
	this.sensorValues = {"d0": 0, "da0": 0, "d1": 0, "da1": 0};
	this.fieldCounter = 0;

	this.TYPES = {"DIGITAL": 0, "ANALOG": 1};

	this.follow = false;

	// For PID controller
	this.integral = 0;
	this.lastError = 0;

	var self = this;

	// Load content and attach handlers
	UI.activeTabReference = this;
	$("#content").load("./tabs/line_follower.html", function()
	{
		// Toggle line following button
		$("#toggle").click(function()
		{
			self.follow = !self.follow;
			if(self.follow)
			{
				this.value = "Stop";
				this.style.background = "#f00";
			}
			else
			{
				// In case the robot was moving stop it
				self.serialDevice.send("s", [0, 0]);
				this.value = "Start";
				this.style.background = "#0f0";
			}
		});

		var rangeFields = ["period", "maxSpeed", "valueDark", "valueLight", "controller-kp", "controller-ki", "controller-kd"];
		rangeFields.forEach(function(field)
		{
			document.getElementById(field).oninput = function()
			{
				$("#" + field).next("span").html(this.value);
			};
		});

		$("#sensorNumber").change(function()
		{
			self.sensorNumber = this.value;
		});

		// Add listener for incoming data
		self.serialDevice.addListener(function(info)
		{
			self.read(info);
		});

		// Start receiving data
		self.update();
	});
}

TABS.line_follower.read = function(info)
{
	var data = new Uint8Array(info.data);

	for(var i = 0; i < data.length; i++)
	{
		switch(data[i])
		{
			case 102: // f
				// Beginning
				this.buffer = "";
				this.fieldCounter = 0;
				break;
			case 10: // line feed
				this.sensorValues[this.fields[this.fieldCounter]] = parseInt(this.buffer);
				$("#" + this.fields[this.fieldCounter]).html(this.buffer);
				this.fieldCounter++;
				this.buffer = "";
				break;
			default:
				this.buffer += String.fromCharCode(data[i]);
		}
	}

	// Compute new wheel speeds
	if(this.fieldCounter == 4 && this.follow)
	{
		var type = $("#type").val();
		var sensorNumber = $("#sensorNumber").val();
		var maxSpeed = parseInt($("#maxSpeed").val());

		if(type == this.TYPES.DIGITAL)
		{
			if(sensorNumber == 1)
			{
				if(this.sensorValues.d0 == 1)
				{
					this.serialDevice.send("s", [maxSpeed, 0]);
				}
				else
				{
					this.serialDevice.send("s", [0, maxSpeed]);
				}
			}
			else if(sensorNumber == 2)
			{
				if(this.sensorValues.d0)
				{
					this.serialDevice.send("s", [maxSpeed, 0]);
				}
				else if(this.sensorValues.d1)
				{
					this.serialDevice.send("s", [0, maxSpeed]);
				}
				else
				{
					this.serialDevice.send("s", [maxSpeed, maxSpeed]);
				}
			}
		}
		else if(type == this.TYPES.ANALOG)
		{
			// Normalise values
			var valueDark = $("#valueDark").val();
			var valueLight = $("#valueLight").val();

			if(sensorNumber == 1)
			{
				// Evaluate hysteresis using light values and normalize between 0 and 1
				var error = 0
				if(this.sensorValues.da0 < valueDark)
				{
					error = (this.sensorValues.da0 - valueDark) / valueDark;
				}
				else if(this.sensorValues.da0 > valueLight)
				{
					error = (this.sensorValues.da0 - valueLight) / (1023 - valueLight);
				}

				var proportional = error * $("#controller-kp").val();
				var integral = (this.integral + error) * $("#controller-ki").val();
				var derivate = (error - this.lastError) * $("#controller-kd").val();

				this.integral = integral;
				this.lastError = error;

				var control = proportional + integral + derivate;

				if(control > 0)
				{
					this.serialDevice.send("s", [(maxSpeed - control) | 0, maxSpeed]);
				}
				else if(control < 0)
				{
					this.serialDevice.send("s", [maxSpeed, (maxSpeed - control) | 0]);
				}
				else
				{
					this.serialDevice.send("s", [maxSpeed, maxSpeed]);
				}
			}
			else if(sensorNumber == 2)
			{
				if(this.sensorValues.da0 < valueDark)
				{
					error = valueDark - error;
				}
				else if(this.sensorValues.da0 > valueLight)
				{
					error = valueLight - error;
				}
			}
		}
	}
}

TABS.line_follower.update = function()
{
	this.serialDevice.send("f");

	if(!this.nextUpdate)
	{
		var self = this;
		this.nextUpdate = window.setTimeout(function()
		{
			self.nextUpdate = false;
			self.update();
		}, parseInt($("#period").val()));
	}
}

TABS.line_follower.cleanup = function()
{
	if(this.nextUpdate)
	{
		window.clearTimeout(this.nextUpdate);
	}
}
