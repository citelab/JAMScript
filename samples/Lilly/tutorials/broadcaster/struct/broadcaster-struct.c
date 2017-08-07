#include <stdio.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
	struct basket local1;
   	struct bag local2;
	
	int i=0;

	while (1) {
		sleep(1);
		printf("*********i=%d**********\n", i);
		local1 = myBasket;
	    local2 = myBag;
	    printf("---------i=%d----------\n", i);
		printf("y=%d\n", y);
		printf("local1.apple=%d local1.pear=%f\n", local1.apple, local1.pear);
	    printf("local2.pen=%d local2.water=%f local2.book=%d\n", local2.pen, local2.water, local2.book);
	    i++;
	}
}