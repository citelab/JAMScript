#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>

jamasync void test(float i){
    void onload() {
		var a;
		console.log("Hello World " + i);
	};
    void onerror() {
        printf("Error received\n");
    };
    void oncomplete() {
        int a;
        printf("Completed!\n");
    };
}

jamasync void bad(){
	void onload() {
		var a;
		blah("Hello World!");
	};
	void onerror() {
		printf("Error received\n");
	};
    void oncomplete() {
        int a;
        printf("Completed!\n");
    };
}

int main() {
	int code;
    int loop = 1;
    while(loop) {
        printf("Your choice: \n \
                1 - Execute hello \n \
                2 - Trigger error \n \
                3 - Quit \n");

        scanf("%d", &code);
        switch (code) {
            case 1:
                test(3.1);
                break;
            case 2:
                bad();
                break;
            case 3:
                loop = 0;
                break;
        }
    }
    return 0;
}
