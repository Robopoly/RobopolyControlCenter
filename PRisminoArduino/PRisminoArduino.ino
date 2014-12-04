#include <prismino.h>
#include <LinearCamera.h>
#include <Servo.h>

#define VERSION_MAJOR 0
#define VERSION_MINOR 3

// Communication method, uncomment only one
#define Comm Serial // for USB
//#define Comm Serial1 // for Bluetooth

// Speed at which to communicate, usually 9600
#define BAUDRATE 9600

// Instance of the camera, it works over I2C and the default address is "5"
LinearCamera lc = LinearCamera(5);
uint8_t *lcDataPtr;

char buffer[16];
Servo servo1, servo2;
uint16_t frequency, duration, value;
uint8_t i, pin;

// Default exposure time in microseconds
uint16_t exposureTime = 100;

void setup()
{
  Comm.begin(BAUDRATE);
}

void loop()
{
  if(Comm.available())
  {
    switch(Comm.read())
    {
    case 'r':
      // Reset: stop motors, detach servomotors and reset all pins to input
      setSpeed(0, 0);
      servo1.detach();
      servo2.detach();
      for(i = 0; i < 24; i++)
      {
        // Do not reset configuration of pins 0 and 1 when Bluetooth is used
        if(Comm == Serial1 && i < 2)
        {
          continue;
        }
        pinMode(i, INPUT);
        // Also remove the pull-up
        digitalWrite(i, LOW);
      }
      break;
    case 's':
      // Set motor speed
      while(Comm.available() < 2);
      setSpeed(Comm.read(), Comm.read());
      break;
    case 't':
      while(Comm.available() < 4);
      frequency = (Comm.read() << 8) | Comm.read();
      duration = (Comm.read() << 8) | Comm.read();
      play(frequency, duration);
      break;
    case '1':
      servo1.attach(S1);
      while(!Comm.available());
      servo1.write(Comm.read());
      break;
    case '2':
      servo2.attach(S2);
      while(!Comm.available());
      servo2.write(Comm.read());
      break;
    case 'l':
      pinMode(LED, OUTPUT);
      while(!Comm.available());
      digitalWrite(LED, Comm.read());
      break;
    case 'm':
      while(Comm.available() < 2);
      pinMode(Comm.read(), Comm.read());
      break;
    case 'g':
      // Dumping all values
      // Format: g[value]\n[value]\n[value]\n[value]\n...
      Comm.print("g");
      for(i = 0; i < 24; i++)
      {
        // 0..13, MISO, SCK, MOSI, SS, A0..A5
        Comm.print((uint8_t)digitalRead(i));
        Comm.print("\n");
      }
      for(i = 18; i < 30; i++)
      {
        // A0..A11
        Comm.print((uint16_t)analogRead(i));
        Comm.print("\n");
      }
      // Write pin modes out
      for(i = 0; i < 24; i++)
      {
        Comm.print((uint8_t)getPinMode(i));
        Comm.print("\n");
      }
      Comm.print(temperature());
      Comm.print("\n");
      break;
    case 'f':
      // Dumping A0 and A1 in diginal and analog
      // Format: v[A0 digital]\n[A0 analog]\n[A1 digital]\n[A1 analog]\n...
      pinMode(LED, OUTPUT);
      digitalWrite(LED, HIGH);
      Comm.print("f");
      Comm.print(digitalRead(A0));
      Comm.print("\n");
      Comm.print(analogRead(A0));
      Comm.print("\n");
      Comm.print(digitalRead(A1));
      Comm.print("\n");
      Comm.print(analogRead(A1));
      Comm.print("\n");
      digitalWrite(LED, LOW);
      break;
    case 'o':
      // Dumping A2..A5 in analog
      // Format: o[A2]\n[A3]\n[A4]\n[A5]\n
      pinMode(LED, OUTPUT);
      digitalWrite(LED, HIGH);
      Comm.print("o");
      Comm.print(analogRead(A2));
      Comm.print("\n");
      Comm.print(analogRead(A3));
      Comm.print("\n");
      Comm.print(analogRead(A4));
      Comm.print("\n");
      Comm.print(analogRead(A5));
      Comm.print("\n");
      digitalWrite(LED, LOW);
      break;
    case 'e':
      // Change exposure time for the linear camera
      while(Comm.available() < 2);
      exposureTime = (Comm.read() << 8) | Comm.read();
      lc.setExpTime(exposureTime);
      break;
    case 'c':
      // Configure the I2C lines
      pinMode(SDA, INPUT); // pin 2
      pinMode(SCL, INPUT); // pin 3
      digitalWrite(SDA, HIGH);
      digitalWrite(SCL, HIGH);
      // Take a picture and return the pointer to the data address' first value
      lcDataPtr = lc.getPixels();
      
      // Linear camera output
      // Format: c[value]\n[value]\n[value]\n[value]\n...
      Comm.print("c");
      // The linear camera is mounted upside down
      for(i = LinearCamera::PIXELS; i > 0; i--)
      {
        Comm.print(*(lcDataPtr + i));
        Comm.print("\n");
      }
      break;
    case 'v':
      // Report version
      Comm.print("v");
      Comm.print(VERSION_MAJOR);
      Comm.print("\n");
      Comm.print(VERSION_MINOR);
      Comm.print("\n");
      break;
    }
  }
}

uint16_t temperature()
{
  uint16_t temp = 0;
  // Set internal 2.56V voltage reference and the input channel to the temperature sensor
  // (p. 309 in the ATmega32U4 datasheet)
  // MUX3 and MUX4 are always 0
  ADCSRB |= _BV(MUX5);
  ADMUX |= _BV(REFS1) | _BV(REFS0) | _BV(MUX2) | _BV(MUX1) | _BV(MUX0);
  
  // This is needed as the new voltage reference doesn't have time to be set otherwise
  // 1ms is not enough, with 3ms it works well
  delay(3);
  
  // Start conversion
  ADCSRA |= _BV(ADSC);
  
  // Wait for ADC conversion end
  while(bit_is_set(ADCSRA, ADSC));
  
  // This value will be converted to C on the computer
  temp = ADC;
  
  // Reset analog conversion voltage reference to Vcc
  ADMUX &= ~(_BV(REFS1));
  
  return temp;
}

uint8_t getPinMode(uint8_t pin)
{
  uint8_t bit = digitalPinToBitMask(pin);
  uint8_t port = digitalPinToPort(pin);
  volatile uint8_t *reg, *out;

  if(port == NOT_A_PIN)
  {
    return -1;
  }
  
  reg = portModeRegister(port);
  out = portOutputRegister(port);

  if((~*reg & bit) == bit)
  {
    if((~*out & bit) == bit)
    {
      return INPUT;
    }
    else
    {
      return INPUT_PULLUP;
    }
  }
  return OUTPUT;
}

