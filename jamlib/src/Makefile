PROJECT = jamlib.a

CC = gcc 
CFLAGS = -Wall -g 


OBJECTS = socket.o command.o event.o callback.o jamlib.o application.o jparser.o utils.o web.o

all: $(PROJECT)

$(PROJECT): $(OBJECTS)
	ar rcs $(PROJECT) $(OBJECTS)

socket.o: socket.h
command.o: command.h
event.o: event.h
callback.o: callback.h
application.o: application.h
jparser.o: jparser.h
utils.o: utils.h
web.o: web.h
jamlib.o: socket.h command.h event.h callback.h jamlib.h application.h jparser.h utils.h web.h

.PHONY : clean
clean :
	rm -f $(PROJECT) $(OBJECTS) *~

