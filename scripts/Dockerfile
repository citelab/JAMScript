FROM ubuntu
RUN apt-get update && apt-get install -y wget \
        build-essential \
        python \
        unzip \
        clang \
        xz-utils \
        texinfo \
        libc-dev \
        cmake \
        libhiredis-dev \
        libevent-dev \
        libbsd-dev \
        mosquitto \
        libssl-dev \
        git
RUN mkdir -p temporary && cd temporary && wget http://prdownloads.sourceforge.net/scons/scons-2.5.0.tar.gz && tar zxvf scons-2.5.0.tar.gz && cd scons-2.5.0 && python setup.py install &
& cd
RUN cd temporary && wget https://nodejs.org/dist/v7.0.0/node-v7.0.0-linux-x64.tar.xz && tar -C /usr/local --strip-components 1 -xJf node-v7.0.0-linux-x64.tar.xz
RUN cd temporary && wget https://github.com/PJK/libcbor/archive/v0.5.0.zip && unzip v0.5.0.zip && cd libcbor-0.5.0 && cmake CMakeLists.txt && make && make install
RUN cd temporary && git clone https://github.com/eclipse/paho.mqtt.c.git && cd paho.mqtt.c && make && make install
RUN cd temporary && wget http://download.redis.io/redis-stable.tar.gz && tar xvzf redis-stable.tar.gz && cd redis-stable && make && make install
RUN apt-get install sudo
RUN cd temporary && wget https://github.com/nanomsg/nanomsg/archive/1.0.0.tar.gz && tar zxvf 1.0.0.tar.gz && cd nanomsg-1.0.0 && ./configure && make && make install
RUN git clone https://github.com/anrl/JAMScript && cd JAMScript/deps/libtask && make && make install
RUN apt-get install -y vim && cd && echo "export NODE_PATH=\$HOME/node_modules:/usr/local/lib/node_modules:\$NODE_PATH" >> .bashrc && /bin/bash -c "source .bashrc"
RUN cd JAMScript && npm install cbor && npm install mime
RUN cd JAMScript && sudo npm install -g lib/jserver && scons && sudo scons install