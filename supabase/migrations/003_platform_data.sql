-- Initial Platform Configuration Data
-- Insert platform configurations with scraping settings

INSERT INTO platforms (name, base_url, logo_url, scraping_config, is_active) VALUES
('devfolio', 'https://devfolio.co', 'https://devfolio.co/favicon.ico', '{
  "selectors": {
    "title": ".hackathon-title, .event-title",
    "description": ".description, .event-description",
    "deadline": ".deadline, .registration-deadline",
    "prize_pool": ".prize-pool, .total-prize",
    "location": ".location, .venue",
    "mode": ".mode, .event-mode",
    "tags": ".tags .tag, .categories .category",
    "url": ".hackathon-link, .event-link"
  },
  "pagination": {
    "next_button": ".next-button, .load-more",
    "max_pages": 10,
    "infinite_scroll": true
  },
  "rate_limit": {
    "requests_per_minute": 30,
    "delay_between_requests": 2000
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "listings": "/hacks",
    "base": "https://devfolio.co"
  }
}', true),

('unstop', 'https://unstop.com', 'https://unstop.com/favicon.ico', '{
  "selectors": {
    "title": ".competition-title, .event-title",
    "description": ".competition-description, .event-description",
    "deadline": ".deadline, .registration-end",
    "prize_pool": ".prize, .reward",
    "location": ".location, .venue",
    "mode": ".mode, .online-offline",
    "tags": ".tags .tag, .categories .category",
    "url": ".competition-link, .event-link"
  },
  "pagination": {
    "next_button": ".pagination-next, .load-more",
    "max_pages": 15,
    "infinite_scroll": false
  },
  "rate_limit": {
    "requests_per_minute": 25,
    "delay_between_requests": 2500
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "hackathons": "/hackathons",
    "competitions": "/competitions",
    "base": "https://unstop.com"
  }
}', true),

('dorahacks', 'https://dorahacks.io', 'https://dorahacks.io/favicon.ico', '{
  "selectors": {
    "title": ".hackathon-title, .bounty-title",
    "description": ".description, .details",
    "deadline": ".deadline, .end-date",
    "prize_pool": ".prize, .reward-amount",
    "location": ".location, .remote-status",
    "mode": ".mode, .remote-hybrid",
    "tags": ".tags .tag, .technologies",
    "url": ".hackathon-link, .bounty-link"
  },
  "pagination": {
    "next_button": ".next-page",
    "max_pages": 20,
    "infinite_scroll": false
  },
  "rate_limit": {
    "requests_per_minute": 20,
    "delay_between_requests": 3000
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "hackathons": "/hackathons",
    "bounties": "/bounties",
    "base": "https://dorahacks.io"
  }
}', true),

('hack2skill', 'https://www.hack2skill.com', 'https://www.hack2skill.com/favicon.ico', '{
  "selectors": {
    "title": ".hackathon-title, .event-name",
    "description": ".event-description, .about-event",
    "deadline": ".registration-deadline, .last-date",
    "prize_pool": ".prize-money, .total-winnings",
    "location": ".event-location, .venue",
    "mode": ".event-mode, .offline-online",
    "tags": ".technologies .tech, .skills-required",
    "url": ".event-link, .register-now"
  },
  "pagination": {
    "next_button": ".next, .load-more-hackathons",
    "max_pages": 12,
    "infinite_scroll": false
  },
  "rate_limit": {
    "requests_per_minute": 28,
    "delay_between_requests": 2200
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "hackathons": "/hackathons",
    "base": "https://www.hack2skill.com"
  }
}', true),

('devpost', 'https://devpost.com', 'https://devpost.com/favicon.ico', '{
  "selectors": {
    "title": ".challenge-title, .hackathon-name",
    "description": ".challenge-description, .about",
    "deadline": ".submission-deadline, .end-date",
    "prize_pool": ".prize, .cash-prizes",
    "location": ".location, .venue",
    "mode": ".format, .online-offline",
    "tags": ".tags .tag, .technologies",
    "url": ".challenge-link, .participate"
  },
  "pagination": {
    "next_button": ".pagination-next",
    "max_pages": 8,
    "infinite_scroll": false
  },
  "rate_limit": {
    "requests_per_minute": 15,
    "delay_between_requests": 4000
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "hackathons": "/hackathons",
    "base": "https://devpost.com"
  }
}', true),

('internshala', 'https://internshala.com', 'https://internshala.com/favicon.ico', '{
  "selectors": {
    "title": ".internship-title, .job-title",
    "description": ".internship-description, .job-description",
    "deadline": ".apply-by, .last-date",
    "stipend": ".stipend, .salary",
    "location": ".location, .work-from",
    "duration": ".duration, .internship-period",
    "tags": ".skills .skill, .requirements",
    "url": ".internship-link, .view-details"
  },
  "pagination": {
    "next_button": ".next-page, .show-more",
    "max_pages": 25,
    "infinite_scroll": true
  },
  "rate_limit": {
    "requests_per_minute": 18,
    "delay_between_requests": 3500
  },
  "headers": {
    "User-Agent": "HackXplore-Bot/1.0 (+https://hackxplore.com)"
  },
  "endpoints": {
    "internships": "/internships",
    "base": "https://internshala.com"
  }
}', true);