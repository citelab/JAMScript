#include <unistd.h>
#include <stdlib.h>

int main() {
	int id;
	for (int i = 1;; i++) {
		id = rand()%3;
		if(id==0) candidate1 = candidate1+1;
		else if(id==1) candidate2 = candidate2+1;
		else candidate3 = candidate3+1;
		sleep(1);
	}
}