#include <unistd.h>
#include <stdlib.h>

int main() {
	int low, diff, date;
	float hum, wind;

	for (int i = 1;; i++) {
		date = i%31+1,
		low  = rand()%15+15;
		diff = rand()%10;
		hum  = (rand()%100)/100;
		wind = rand()%25+(rand()%10)/10;
		MTLWeather = {
			.date: date,
			.lowTemperature: low,
			.highTemperature: low+diff,
			.humidity: hum,
			.wind: wind,
			.airQuality: "good",
			.UV: "strong"
		};
		usleep(30000);
	}
}