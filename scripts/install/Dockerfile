FROM ubuntu
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils && \
        apt-get install -y wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim \
        curl \
        iproute2 \
        net-tools \
        iputils-ping \
        inotify-tools

RUN useradd -m admin && echo "admin:admin" | chpasswd && adduser admin sudo
USER admin
WORKDIR /home/admin
RUN mkdir ~/.npm-global && npm config set prefix '~/.npm-global' && \
    cat /home/admin/JAMScript/scripts/install/profile_addition > /home/admin/.profile && \
    source /home/admin/.profile

RUN git clone --recursive https://github.com/citelab/JAMScript && \
        cd JAMScript/tools && git checkout master && git pull && \
        cd ../samples && git checkout master && git pull

RUN curl -sL https://deb.nodesource.com/setup_11.x | sudo -E bash - && \
        sudo apt-get install -y nodejs

WORKDIR /home/admin/JAMScript
RUN sudo npm -g install jamscript

CMD chmod -R a+Xr /etc/avahi && sed -i "s|rlimit-nproc=3|#rlimit-nproc=3 |g" /etc/avahi/avahi-daemon.conf && cd /var/run/ && rm -rf dbus && mkdir dbus && dbus-daemon --system &&  avahi-daemon
