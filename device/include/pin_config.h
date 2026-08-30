#pragma once

// Waveshare ESP32-S3-Touch-AMOLED-1.8 (V2: CO5300 display driver + CST820 touch)
// Source: https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.8
//   examples/arduino-v2/libraries/Mylibrary/pin_config.h

#define XPOWERS_CHIP_AXP2101

// Display (QSPI)
#define LCD_SDIO0 4
#define LCD_SDIO1 5
#define LCD_SDIO2 6
#define LCD_SDIO3 7
#define LCD_SCLK 11
#define LCD_CS 12
#define LCD_WIDTH 368
#define LCD_HEIGHT 448

// Shared I2C bus: touch (CST820), IMU (QMI8658), PMIC (AXP2101)
#define IIC_SDA 15
#define IIC_SCL 14
#define TP_INT 21

// ES8311 audio codec (not used yet)
#define I2S_MCK_IO 16
#define I2S_BCK_IO 9
#define I2S_DI_IO 10
#define I2S_WS_IO 45
#define I2S_DO_IO 8
