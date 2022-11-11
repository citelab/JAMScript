jtask double calc(int c, double x) {
		return x * c;
}

jtask int number(int c, double y) {
		return c + round(y);
}

jtask* localtask() {
		int i = 10;
		double x = 25.0;
		double y;
		int z;

		while (1) {
				i = i + 1;
				x = 1.5 * x;
				y = calc(i, x);
				z = number(i, x);
				printf("Y = %f, Z = %d\n", y, z);				
		}
}

int main(int argc, char *argv[])
{
		localtask();
}
