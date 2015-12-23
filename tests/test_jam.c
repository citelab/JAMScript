#include "../lib/jamlib/jamlib.h"
#include <stdio.h>
#include <stdlib.h>

jsync int stest(int b) {
    var a = b*2;
    return a;
}

jasync void test(char * i){
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

int main() {
	int code;
    int loop = 1;
    while(loop) {
        printf("Your choice: \n \
                1 - ASync \n \
                2 - Sync \n \
                3 - Quit \n");

        scanf("%d", &code);
        switch (code) {
            case 1:
                test("hi");
                break;
            case 2:
                stest(3);
                break;
            case 3:
                loop = 0;
                break;
        }
    }
    return 0;
}
