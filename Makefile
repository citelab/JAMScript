PROJECT = jamc

.PHONY: all
all: 
	$(MAKE) -C lib/jamlib/c_core
	$(MAKE) -C lib/jamrun
