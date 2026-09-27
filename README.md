
```bash
npm install
npm run dev      # dev server at http://localhost:8080 with hot reload
npm run build    # production build in dist/ (zip it for itch.io)
npm run preview  # serve the built dist/ locally
```

```lessons learned
from zombopoly -
    * the lack of animation in zombopoly was very noticible, the bobbing up and down and rocking back and forth successfully emulated a "breathing" idle and a walking animation, but fell short overall. The overhead on animations for hand-drawn sprites is very high. that led me to lean towards pixel art this time, with modular body parts (eg. the torso and arms and legs being separate). so that I could animate with phaser's inbuilt animation system.
    * zombopoly was built on godot, which was the first time I really worked with godot. I noticed a lot of things I liked, but there were some shortcomings. GUI based engines are good, but there's a lot of visual noise that can be distracting. I was recommended by a professor to try phaser, so I did for this jam. 
    * The item system in zombopoly was highly ambitious, as well as having several different characters with dramatically different abilities and stats. this was an ambitious undertaking over the roughly month and a half that was alotted to the game development part of the course that zombopoly was built for. having learned that lesson, I elected to implement only 2 enemies and 1 player character, which massively cut down on overhead.
    * Using tutorials and AI greatly expedited my ability to program for zombopoly; overlapping tasks like drawing, thinking of level design, and eating alongside consuming tutorials allowed me to effectively always be making progress on the game, and using AI to explain more complicated concepts and completely eliminate the need for me to write busywork code like worker functions or port functions over from other scripts I already wote was highly effective. This time I took that farther by having AI equate godot tools and functions to phaser ones so I could immediately grasp the differences. Additionally, having AI optimize my code from ~2.5k to ~1.5k lines of code greatly improved the efficieny of the game. 
    * Zombopoly could have benefitted heavily from the addition of sound effects and music. At the time I did not know how to make music, and to a large extent I still do not, but I tried my best.
    * Zombopoly had only one instance of a particle effect, being the item effect. This game I learned the particle system for phaser, which is pretty simple. Several thing emmit particles, breaking blocks, shooting gun, hitting things, and killing enemies for example.
    * Zombopoly was built off of a board game I had made previously in the semster, which was difficult to translate over to the online world and still be something that resembles the real life version. this is a problem I did not have this game jam. 
```


```takeaways
This game still had some problems. My music is bad, I can remedy this by learning it more and amassing a large volume of samples. Something I did not do on this one that I did on zombopoly is heavily document things. I wrote a lot of theory and had a large planning phase before I began programming. This game saw a lot of iterations, I tried using the phaser visual functions to make trees and texture the world more, but I didn't like it more than the simplicity of the current build. The use of AI in this one bothered me, I felt like I was over using it and it feels very sacrilegious to use it for me still. it is very nice to have AI make a frame or template for a document, and to have it clean everything up. The time it takes for AI to optimize everything and then manually look over everything is much lower than optimizing it myself. there were multiple instances when I got used to a function name and then after having AI optimize the code it would merge functions and I would feel lost for a second, that sucked. One  time it broke the crouch function and on stand-up it allowed the player to clip through the ground. I solved these things by having AI comment a lot; although it did remove comments by me such as "// if I ever wrote a function as bad as this one again I should be shot" or "// if employers find this block of identifiers I will be blacklisted from every hiring portal". 
```