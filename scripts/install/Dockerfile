FROM ubuntu
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils && \
        apt-get install -y -q wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim \
        curl \
        libssl-dev \
        cmake \
        iproute2 \
        net-tools \
        iputils-ping \
        inotify-tools

RUN useradd -m admin && echo "admin:admin" | chpasswd && adduser admin sudo
RUN echo "admin ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers
USER admin
WORKDIR /home/admin
RUN wget https://deb.nodesource.com/setup_11.x && chmod +x ./setup_11.x && echo admin | sudo -S ./setup_11.x && \
        sudo apt-get install -y -q nodejs

RUN git clone --recursive https://github.com/citelab/JAMScript && \
        cd JAMScript/tools && git checkout master && git pull && \
        cd ../samples && git checkout master && git pull

RUN mkdir ~/.npm-global && npm config set prefix '~/.npm-global' && \
    cat /home/admin/JAMScript/scripts/install/profile_addition.txt > /home/admin/.profile

WORKDIR /home/admin/JAMScript
RUN npm -g install jamscript

CMD chmod -R a+Xr /etc/avahi && sed -i "s|rlimit-nproc=3|#rlimit-nproc=3 |g" /etc/avahi/avahi-daemon.conf && cd /var/run/ && rm -rf dbus && mkdir dbus && dbus-daemon --system &&  avahi-daemon
