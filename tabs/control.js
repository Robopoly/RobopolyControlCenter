"use strict";

TABS.control = {};
TABS.control.initialize = function(serialDevice)
{
	this.serialDevice = serialDevice;
	this.speed = {'left': 0, 'right': 0};
	this.currentSpeed = {'left': 0, 'right': 0};
	this.nextUpdate = false;
	this.period = 100;

	this.keys = {};

	this.PROFILE = {
		"SQUARE": 0,
		"TRAPEZOID": 1
	};

	var self = this;

	$("#content").load("./tabs/control.html", function()
	{
		$(document).keydown(function(e)
		{
			var key = String.fromCharCode(e.keyCode).toLowerCase();
			self.onKeyEvent(key, true);
		});

		$(document).keyup(function(e)
		{
			var key = String.fromCharCode(e.keyCode).toLowerCase();
			self.onKeyEvent(key, false);
		});

		var controlKeys = ["w", "a", "s", "d"];
		controlKeys.forEach(function(key)
		{
			$("#dir_" + key).mousedown(function(e)
			{
				self.onKeyEvent(key, true);
			}).mouseup(function(e)
			{
				self.onKeyEvent(key, false);
			}).mouseout(function(e)
			{
				self.onKeyEvent(key, false);
			});
		});

		document.getElementById("maxSpeed").oninput = function()
		{
			$(this).next("span").html(this.value);
			self.control();
		};

		var rangeFields = ["frequency", "duration"];
		rangeFields.forEach(function(field)
		{
			document.getElementById(field).oninput = function()
			{
				$("#" + field).next("span").html(this.value);
			};
		});

		document.getElementById("acceleration").oninput = function()
		{
			$(this).next("span").html(this.value * (1000 / self.period));
		};

		$("#play").click(function()
		{
			// Send tone data in "t[frequency high byte][frequency low byte][duration high byte][duration low byte]" format
			var frequency = $("#frequency").val();
			var duration = $("#duration").val();

			self.serialDevice.send("t", [frequency >> 8, frequency & 0xff, duration >> 8, duration & 0xff]);
		});

		document.getElementById("servo-1").oninput = function()
		{
			$(this).next("span").html(this.value);
			self.serialDevice.send("1", [this.value]);
		};

		document.getElementById("servo-2").oninput = function()
		{
			$(this).next("span").html(this.value);
			self.serialDevice.send("2", [this.value]);
		};

		$("#led").change(function()
		{
			self.serialDevice.send("l", [this.checked ? 1 : 0]);
		});
	});
}

TABS.control.cleanup = function()
{
	if(this.nextUpdate)
	{
		window.clearTimeout(this.nextUpdate);
	}
}

TABS.control.onKeyEvent = function(key, state)
{
	// Prevent multiple calls
	if(this.keys[key] == state)
	{
		return;
	}

	this.keys[key] = state;

	this.control();
}

TABS.control.control = function()
{
	this.speed.left = 0;
	this.speed.right = 0;

	var maxSpeed = parseInt($("#maxSpeed").val());

	if(this.keys["w"])
	{
		this.speed.left += maxSpeed;
		this.speed.right += maxSpeed;
	}
	if(this.keys["a"])
	{
		this.speed.left -= maxSpeed;
		this.speed.right += maxSpeed;
	}
	if(this.keys["s"])
	{
		this.speed.left -= maxSpeed;
		this.speed.right -= maxSpeed;
	}
	if(this.keys["d"])
	{
		this.speed.left += maxSpeed;
		this.speed.right -= maxSpeed;
	}

	// Limit speed values to maximum speed at all times
	if(Math.abs(this.speed.left) > maxSpeed)
	{
		this.speed.left = maxSpeed * (this.speed.left > 0 ? 1 : -1);
		this.speed.right *= maxSpeed / Math.abs(this.speed.left);
	}
	else if(Math.abs(this.speed.right) > maxSpeed)
	{
		this.speed.right = maxSpeed * (this.speed.right > 0 ? 1 : -1);
		this.speed.left *= maxSpeed / Math.abs(this.speed.right);
	}

	this.setSpeed();
}

TABS.control.setSpeed = function()
{
	if($("#profile").val() == this.PROFILE.SQUARE)
	{
		// A square profile doesn't have any acceleration ramp
		this.currentSpeed = {'left': this.speed.left, 'right': this.speed.right};
	}
	else if($("#profile").val() == this.PROFILE.TRAPEZOID)
	{
		var acceleration = parseInt($("#acceleration").val());

		// Accelerate/decelerate left wheel
		if(this.speed.left > 0 && this.currentSpeed.left < this.speed.left && this.currentSpeed.left + acceleration <= this.speed.left)
		{
			this.currentSpeed.left += acceleration;
		}
		else if(this.speed.left > 0 && this.currentSpeed.left < this.speed.left && this.currentSpeed.left + acceleration > this.speed.left)
		{
			this.currentSpeed.left = this.speed.left;
		}
		else if(this.speed.left < 0 && this.currentSpeed.left > this.speed.left && this.currentSpeed.left - acceleration >= this.speed.left)
		{
			this.currentSpeed.left -= acceleration;
		}
		else if(this.speed.left < 0 && this.currentSpeed.left > this.speed.left && this.currentSpeed.left - acceleration < this.speed.left)
		{
			this.currentSpeed.left = this.speed.left;
		}
		else if(this.speed.left == 0 && this.currentSpeed.left > 0 && this.currentSpeed.left - acceleration >= 0)
		{
			this.currentSpeed.left -= acceleration;
		}
		else if(this.speed.left == 0 && this.currentSpeed.left > 0 && this.currentSpeed.left - acceleration < 0)
		{
			this.currentSpeed.left = 0;
		}
		else if(this.speed.left == 0 && this.currentSpeed.left < 0 && this.currentSpeed.left + acceleration <= 0)
		{
			this.currentSpeed.left += acceleration;
		}
		else if(this.speed.left == 0 && this.currentSpeed.left < 0 && this.currentSpeed.left + acceleration > 0)
		{
			this.currentSpeed.left = 0;
		}

		// Accelerate/decelerate right wheel
		if(this.speed.right >= 0 && this.currentSpeed.right < this.speed.right && this.currentSpeed.right + acceleration <= this.speed.right)
		{
			this.currentSpeed.right += acceleration;
		}
		else if(this.speed.right >= 0 && this.currentSpeed.right < this.speed.right && this.currentSpeed.right + acceleration > this.speed.right)
		{
			this.currentSpeed.right = this.speed.right;
		}
		else if(this.speed.right < 0 && this.currentSpeed.right > this.speed.right && this.currentSpeed.right - acceleration >= this.speed.right)
		{
			this.currentSpeed.right -= acceleration;
		}
		else if(this.speed.right < 0 && this.currentSpeed.right > this.speed.right && this.currentSpeed.right - acceleration < this.speed.right)
		{
			this.currentSpeed.right = this.speed.right;
		}
		else if(this.speed.right == 0 && this.currentSpeed.right > 0 && this.currentSpeed.right - acceleration >= 0)
		{
			this.currentSpeed.right -= acceleration;
		}
		else if(this.speed.right == 0 && this.currentSpeed.right > 0 && this.currentSpeed.right - acceleration < 0)
		{
			this.currentSpeed.right = 0;
		}
		else if(this.speed.right == 0 && this.currentSpeed.right < 0 && this.currentSpeed.right + acceleration <= 0)
		{
			this.currentSpeed.right += acceleration;
		}
		else if(this.speed.right == 0 && this.currentSpeed.right < 0 && this.currentSpeed.right + acceleration > 0)
		{
			this.currentSpeed.right = 0;
		}
	}

	this.serialDevice.send("s", [this.currentSpeed.left, this.currentSpeed.right]);

	// If the final speed is not reached yet call this function again in 100ms
	if(!this.nextUpdate && (this.currentSpeed.left != this.speed.left || this.currentSpeed.right != this.speed.right))
	{
		var self = this;
		this.nextUpdate = window.setTimeout(function()
		{
			// This ensures the script is not called more often than 100ms if the user inputs faster than 100ms
			self.nextUpdate = false;
			self.setSpeed();
		}, this.period);
	}
}
