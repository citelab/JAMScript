#include "carapi/carctl.h"

int forward_steps = 0;
int backward_steps = 0;
car_context_t car;

jtask* go_forward(int steps) {
    forward_steps = steps;
    backward_steps = 0;
}

jtask* go_backward(int steps) {
    forward_steps = steps;
    backward_steps = 0;
}

jtask* drive_loop() {
    while(1) {
	if(forward_steps>0) {
	    car_throttle(&car, 0.1);
	    forward_steps--;
	} else if (backward_steps>0) {
	    car_throttle(&car, -0.1);
	    backwards--;
	} else {
	    car_throttle(&car, 0);
	}
	
	// Sleep One-Tenth Second
	jsleep(100000);
    }
}


int main(int argc, char*argv[]) {
    // Config For Our Car.
    car_context_descriptor_t descriptor;
    descriptor.steering_center = 1130;
    descriptor.steering_range  = 200;
    descriptor.throttle_offset = 1000;
    descriptor.throttle_range  = 700;
    // Real reverse delta is around 50, but this leads to smoother transition.
    descriptor.throttle_reverse_delta = 30;
    descriptor.throttle_reverse_scale = 8;

    car_create(&car, descriptor);
    
    drive_loop(1);
    return 0;
}

