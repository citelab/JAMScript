PROJECT = jamc

.PHONY: all
all: 
	$(MAKE) -C lib/jamlib
	$(MAKE) -C lib/jamrun
