#==================================================================#
# @description: makefile for compiling pigpio programs
# @author: Matthew L-K matthew.lesko-krlez@mail.mcgill.ca
# 
# Modification Log:
# Date                  Author                  Modification
# -----------------------------------------------------------------
# 23-Oct-2018           Matthew L-K             Created the file
#
#==================================================================#

# Define required macros here
SHELL = /bin/sh
CC = gcc
DIR_SRC = ./src/
DIR_TARGET = ./target/
CFLAG = -Wall
LIBS = -pthread -lpigpio -lrt

# Define targets here
all: test_temperature.o test_gpio.o

test_temperature.o : src/test_temperature.c
	${CC} ${CFLAG} ${LIBS} $? -o ${DIR_TARGET}$@

test_light.o : src/test_light.c
	${CC} ${CFLAG} ${LIBS} $? -o ${DIR_TARGET}$@

test_gpio.o : src/test_gpio.c
	${CC} ${CFLAG} ${LIBS} $? -o ${DIR_TARGET}$@

clean : 
	 rm -f ${DIR_TARGET}*.o

