package com.annara.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootApplication(
        scanBasePackages = "com.annara",
        exclude = {UserDetailsServiceAutoConfiguration.class}
)
@EnableMongoRepositories(basePackages = "com.annara.repository")
public class AnnaraApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnnaraApplication.class, args);
    }
}
