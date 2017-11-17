void* getHealth(char *);

jasync forwardHealthCommand(char* node) {
	printf("JCond broadcast requested for health...\n");
	getHealth(node);
}

int main() {
	printf("C node online\n");
}