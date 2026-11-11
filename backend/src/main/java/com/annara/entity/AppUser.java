package com.annara.entity;

import com.annara.enums.Role;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "users")
public class AppUser {
    @Id
    public String id;

    public String fullName;
    public String organisationName;

    @Indexed(unique = true)
    public String email;

    public String passwordHash;
    public String phone;
    public String city;

    @Indexed
    public Role role;

    public String avatarFile;
    public LocalDateTime createdAt = LocalDateTime.now();
}
